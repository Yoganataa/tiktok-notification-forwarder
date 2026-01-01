// src/index.ts
import { Client, GatewayIntentBits, Events, REST, Routes, ActivityType } from 'discord.js';
import { database } from './core/database/connection';
import { configManager } from './core/config/config';
import { logger } from './utils/logger';
import { handleInteractionError } from './utils/error-handler';
import { commandList } from './commands';

// Controllers
import { handleMappingCommand } from './commands/mapping.command';
import { handleMenuCommand } from './commands/menu.command';
import { handleAdminCommand } from './commands/admin.command';
import { AdminController } from './controllers/admin.controller';

// Services & Repositories
import { UserMappingRepository } from './repositories/user-mapping.repository';
import { AccessControlRepository } from './repositories/access-control.repository';
import { SystemConfigRepository } from './repositories/system-config.repository';
import { PermissionService } from './services/permission.service';
import { NotificationService } from './services/notification.service';
import { ForwarderService } from './services/forwarder.service';
import { MigrationService } from './services/migration.service';

/**
 * Main Application Class.
 * * Responsible for managing the bot lifecycle, dependency injection, 
 * event routing, and database connections.
 */
class Application {
  private client: Client;
  private config: ReturnType<typeof configManager.get>;
  private forwarderService: ForwarderService;
  private permissionService: PermissionService;
  private adminController: AdminController;
  private systemConfigRepo: SystemConfigRepository;
  private isShuttingDown = false;

  /**
   * Initializes the Application instance.
   * Sets up the Discord client, loads configuration, and instantiates
   * necessary repositories, services, and controllers.
   */
  constructor() {
    this.config = configManager.load();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      presence: {
        activities: [{ name: 'TikTok notifications', type: ActivityType.Watching }],
        status: 'online',
      },
    });

    const userMappingRepo = new UserMappingRepository();
    const accessControlRepo = new AccessControlRepository();
    this.systemConfigRepo = new SystemConfigRepository();

    this.permissionService = new PermissionService(accessControlRepo);
    const notificationService = new NotificationService(userMappingRepo);
    this.forwarderService = new ForwarderService(notificationService);

    this.adminController = new AdminController(
      this.permissionService,
      this.systemConfigRepo,
      userMappingRepo,
      this.configManagerReload.bind(this)
    );

    this.setupEventHandlers();
  }

  /**
   * Starts the application lifecycle.
   * * This method establishes the database connection, runs migrations,
   * synchronizes configuration, and logs in the Discord client.
   */
  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting TikTok Notification Forwarder Bot...');

      // PERBAIKAN DI SINI: Menambahkan properti 'driver'
      await database.connect({
        driver: this.config.database.driver, 
        connectionString: this.config.database.url,
        ssl: this.config.database.ssl,
        maxConnections: this.config.database.maxConnections,
        minConnections: this.config.database.minConnections,
      });

      const migrationService = new MigrationService();
      await migrationService.run();

      await this.configManagerReload();

      await this.client.login(this.config.discord.token);
    } catch (error) {
      logger.error('❌ Critical failure during application startup', { 
        error: (error as Error).message 
      });
      await this.shutdown(1);
    }
  }

  /**
   * Synchronizes in-memory configuration with database values.
   * * Ensures that dynamic changes made via the Admin Panel are applied immediately
   * without requiring a full restart.
   */
  private async configManagerReload(): Promise<void> {
    try {
      await configManager.loadFromDatabase(this.systemConfigRepo);
      this.config = configManager.get();
    } catch (error) {
      logger.error('Failed to synchronize dynamic configuration', { 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Sets up Discord event listeners.
   * Handles initialization on 'ready', message processing, and interaction routing.
   */
  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, async (readyClient) => {
      logger.info(`✅ Bot authenticated as ${readyClient.user.tag}`);
      try {
        await this.registerCommands();
        await this.logServerInfo();
        logger.info('✨ Initialization complete. Bot is ready.');
      } catch (error) {
        logger.error('Post-login initialization failed', { error: (error as Error).message });
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.id === this.client.user?.id) return;
      
      try {
        await this.forwarderService.processMessage(message);
      } catch (error) {
        logger.error('Message processing error', { error: (error as Error).message });
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
          await this.adminController.handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
          await this.adminController.handleModal(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this.adminController.handleSelectMenu(interaction);
        }
      } catch (error) {
        await handleInteractionError(interaction, error as Error);
      }
    });
  }

  /**
   * Routes slash commands to their respective handlers based on command name.
   * * @param interaction - The interaction object received from Discord.
   */
  private async handleSlashCommand(interaction: any) {
    switch (interaction.commandName) {
      case 'mapping': await handleMappingCommand(interaction, this.permissionService); break;
      case 'menu': await handleMenuCommand(interaction, this.permissionService); break;
      case 'admin': await handleAdminCommand(interaction, this.permissionService); break;
    }
  }

  /**
   * Registers slash commands with the Discord API.
   * * Updates global commands and clears guild-specific commands in the core server
   * to prevent duplication.
   */
  private async registerCommands(): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(this.config.discord.token);
      const commandsBody = commandList.map((cmd) => cmd.toJSON());

      logger.info('Updating global slash commands...', { count: commandsBody.length });
      await rest.put(Routes.applicationCommands(this.config.discord.clientId), { body: commandsBody });
      
      if (this.config.discord.coreServerId) {
        await rest.put(Routes.applicationGuildCommands(this.config.discord.clientId, this.config.discord.coreServerId), { body: [] });
      }
    } catch (error) {
      logger.error('Slash command registration failed', { error: (error as Error).message });
    }
  }

  /**
   * Logs details about the guilds the bot is currently joined to.
   * Used for monitoring server access and verifying the core server connection.
   */
  private async logServerInfo(): Promise<void> {
    try {
      const guilds = await this.client.guilds.fetch();
      logger.info(`Guild Access: Active in ${guilds.size} servers`);
      for (const [id, guild] of guilds) {
        const fullGuild = await guild.fetch();
        logger.info(`- ${fullGuild.name} (${fullGuild.id}) | Core: ${id === this.config.discord.coreServerId}`);
      }
    } catch (error) {
      logger.warn('Failed to fetch detailed server information', { error: (error as Error).message });
    }
  }

  /**
   * Gracefully shuts down the application.
   * Closes database connections and destroys the Discord client instance.
   * * @param exitCode - The exit code to use for the process (default: 0).
   */
  async shutdown(exitCode = 0): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    logger.info('Initiating graceful shutdown...', { exitCode });
    try {
      await database.disconnect();
      this.client.destroy();
      logger.info('Graceful shutdown completed successfully.');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown procedure', { error: (error as Error).message });
      process.exit(1);
    }
  }
}

// Instantiate and start
const app = new Application();

// Global uncaught error handling
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason) 
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  app.shutdown(1);
});

process.on('SIGINT', () => app.shutdown(0));
process.on('SIGTERM', () => app.shutdown(0));

app.start();