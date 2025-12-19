// src/index.ts
import { Client, GatewayIntentBits, Events, REST, Routes, ActivityType } from 'discord.js';
import { database } from './core/database/connection';
import { configManager } from './core/config/config';
import { logger } from './utils/logger';
import { commandList } from './commands';
import { handleMappingCommand } from './commands/mapping.command';
import { handleMenuCommand } from './commands/menu.command';
import { handleAdminCommand } from './commands/admin.command';

// Service initialization
import { UserMappingRepository } from './repositories/user-mapping.repository';
import { AccessControlRepository } from './repositories/access-control.repository';
import { PermissionService } from './services/permission.service';
import { NotificationService } from './services/notification.service';
import { ForwarderService } from './services/forwarder.service';

class Application {
  private client: Client;
  private config: ReturnType<typeof configManager.get>;
  private forwarderService: ForwarderService;
  private permissionService: PermissionService;
  private isShuttingDown = false;

  constructor() {
    // Load configuration
    this.config = configManager.load();

    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      presence: {
        activities: [
          {
            name: 'TikTok notifications',
            type: ActivityType.Watching,
          },
        ],
        status: 'online',
      },
    });

    // Initialize repositories
    const userMappingRepo = new UserMappingRepository();
    const accessControlRepo = new AccessControlRepository();

    // Initialize services
    this.permissionService = new PermissionService(accessControlRepo);
    const notificationService = new NotificationService(userMappingRepo);
    this.forwarderService = new ForwarderService(notificationService);

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting TikTok Notification Forwarder Bot', {
        environment: this.config.app.nodeEnv,
        version: '2.0.0',
      });

      // Connect to database
      await database.connect({
        connectionString: this.config.database.url,
        ssl: this.config.app.nodeEnv === 'production',
        maxConnections: this.config.database.maxConnections,
        minConnections: this.config.database.minConnections,
      });

      // Login to Discord
      await this.client.login(this.config.discord.token);
    } catch (error) {
      logger.error('Failed to start application', {
        error: (error as Error).message,
      });
      await this.shutdown(1);
    }
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, async (readyClient) => {
      logger.info('Bot authenticated', {
        username: readyClient.user.tag,
        id: readyClient.user.id,
      });

      try {
        await this.registerCommands();
        await this.logServerInfo();
        logger.info('Bot initialization complete');
      } catch (error) {
        logger.error('Initialization failed', {
          error: (error as Error).message,
        });
        await this.shutdown(1);
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.id === this.client.user?.id) {
        return;
      }

      try {
        await this.forwarderService.processMessage(message);
      } catch (error) {
        logger.error('Error processing message', {
          messageId: message.id,
          error: (error as Error).message,
        });
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        switch (interaction.commandName) {
          case 'mapping':
            await handleMappingCommand(interaction, this.permissionService);
            break;
          case 'menu':
            await handleMenuCommand(interaction, this.permissionService);
            break;
          case 'admin':
            await handleAdminCommand(interaction, this.permissionService);
            break;
        }
      } catch (error) {
        logger.error('Error handling interaction', {
          commandName: interaction.commandName,
          error: (error as Error).message,
        });
      }
    });

    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error', { error: error.message });
    });

    this.client.on(Events.Warn, (warning) => {
      logger.warn('Discord client warning', { warning });
    });
  }

  /**
   * Register slash commands
   */
  private async registerCommands(): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(
        this.config.discord.token
      );

      const commandsBody = commandList.map((cmd) => cmd.toJSON());

      logger.info('Registering slash commands', {
        count: commandsBody.length,
      });

      await rest.put(Routes.applicationCommands(this.config.discord.clientId), {
        body: commandsBody,
      });

      logger.info('Commands registered successfully');

      // Clear guild-specific commands
      if (this.config.discord.coreServerId) {
        await rest.put(
          Routes.applicationGuildCommands(
            this.config.discord.clientId,
            this.config.discord.coreServerId
          ),
          { body: [] }
        );
        logger.info('Guild commands cleared from core server');
      }
    } catch (error) {
      logger.error('Failed to register commands', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Log server information
   */
  private async logServerInfo(): Promise<void> {
    try {
      const guilds = await this.client.guilds.fetch();
      logger.info('Connected to servers', { count: guilds.size });

      for (const [id, guild] of guilds) {
        const fullGuild = await guild.fetch();
        logger.info('Server details', {
          id: fullGuild.id,
          name: fullGuild.name,
          memberCount: fullGuild.memberCount,
          isCoreServer: id === this.config.discord.coreServerId,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch server information', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(exitCode = 0): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Initiating graceful shutdown', { exitCode });

    try {
      // Disconnect database
      await database.disconnect();

      // Destroy Discord client
      this.client.destroy();

      logger.info('Shutdown complete');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }
}

// Create application instance
const app = new Application();

// Handle process events
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message });
  app.shutdown(1);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  app.shutdown(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  app.shutdown(0);
});

// Start application
app.start();