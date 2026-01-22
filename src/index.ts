import 'dotenv/config';
import { Client, GatewayIntentBits, Events, REST, Routes, ActivityType } from 'discord.js';
import { database } from './core/database/connection';
import { configManager } from './core/config/config';
import { logger } from './shared/utils/logger';
import { handleInteractionError } from './shared/utils/error-handler';
import { commandList } from './features/commands.registry';

// Controllers & Handlers
import { handleMappingCommand, mappingCommand } from './features/mapping/mapping.command';
import { handleMenuCommand } from './features/menu/menu.command';
import { handleAdminCommand } from './features/admin/admin.command';
import { handleTikTokCommand, tiktokCommand } from './features/tiktok/tiktok.command';
import { startCommand, handleStartCommand } from './features/start/start.command';
import { reforgotCommand, handleReforgotCommand } from './features/admin/reforgot.command';
import { MenuController } from './features/menu/menu.controller';

// Services & Repositories
import { UserMappingRepository } from './core/repositories/user-mapping.repository';
import { AccessControlRepository } from './core/repositories/access-control.repository';
import { SystemConfigRepository } from './core/repositories/system-config.repository';
import { QueueRepository } from './core/repositories/queue.repository';
import { PermissionService } from './features/admin/permission.service';
import { NotificationService } from './features/notification/notification.service';
import { ForwarderService } from './features/forwarder/forwarder.service';
import { QueueService } from './features/queue/queue.service';
import { DownloaderService } from './features/downloader/downloader.service';
import { MigrationService } from './core/services/migration.service';
import { StartupService } from './core/services/startup.service';

class Application {
  private client: Client;
  private config: ReturnType<typeof configManager.get>;
  private forwarderService: ForwarderService;
  private queueService: QueueService;
  private permissionService: PermissionService;
  private menuController: MenuController;
  private systemConfigRepo: SystemConfigRepository;
  private isShuttingDown = false;

  constructor() {
    this.config = configManager.load();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    const userMappingRepo = new UserMappingRepository();
    const accessControlRepo = new AccessControlRepository();
    this.systemConfigRepo = new SystemConfigRepository();

    const queueRepo = new QueueRepository();
    const downloaderService = new DownloaderService(this.systemConfigRepo);
    const notificationService = new NotificationService(userMappingRepo);
    this.queueService = new QueueService(queueRepo, downloaderService, notificationService, this.systemConfigRepo);

    this.permissionService = new PermissionService(accessControlRepo);
    this.forwarderService = new ForwarderService(notificationService, this.queueService, userMappingRepo);

    this.menuController = new MenuController(
      this.permissionService,
      this.systemConfigRepo,
      userMappingRepo,
      this.configManagerReload.bind(this)
    );

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting TikTok Notification Forwarder Bot...');

      await StartupService.init();

      await database.connect({
        driver: this.config.database.driver,
        connectionString: this.config.database.url,
        maxConnections: this.config.database.maxConnections,
        minConnections: this.config.database.minConnections
      });

      const migrationService = new MigrationService();
      await migrationService.run();

      await this.configManagerReload();

      setInterval(() => this.queueService.processQueue(this.client), 5000);

      await this.client.login(this.config.discord.token);
    } catch (error) {
      logger.error('❌ Critical failure during application startup', {
        error: (error as Error).message
      });
      process.exit(1);
    }
  }

  private async configManagerReload(): Promise<void> {
    try {
      await configManager.loadFromDatabase(this.systemConfigRepo);
      logger.info('Configuration reloaded from database');
    } catch (error) {
      logger.error('Failed to load dynamic config', { error: (error as Error).message });
    }
  }

  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, async (readyClient) => {
      logger.info(`✅ Bot authenticated as ${readyClient.user.tag}`);
      await this.registerCommands();
      await this.logServerInfo();

      this.client.user?.setActivity('TikTok Live', { type: ActivityType.Watching });
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
          await this.menuController.handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
          await this.menuController.handleModal(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this.menuController.handleSelectMenu(interaction);
        }
      } catch (error) {
        await handleInteractionError(interaction, error as Error);
      }
    });
  }

  private async handleSlashCommand(interaction: any) {
    // Only block commands if it's NOT the 'reforgot' command
    if (interaction.commandName !== 'reforgot' && interaction.guildId !== this.config.discord.coreServerId) {
        await interaction.reply({ content: '⛔ Commands are only available in the Core Server.', ephemeral: true });
        return;
    }

    switch (interaction.commandName) {
      case 'mapping': await handleMappingCommand(interaction, this.permissionService); break;
      case 'menu': await handleMenuCommand(interaction, this.permissionService); break;
      case 'admin': await handleAdminCommand(interaction, this.permissionService); break;
      case 'tiktok': await handleTikTokCommand(interaction); break;
      case 'start': await handleStartCommand(interaction); break;
      case 'reforgot': await handleReforgotCommand(interaction, this.permissionService, this.forwarderService); break;
    }
  }

  private async registerCommands(): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(this.config.discord.token);

      const commandsBody = [
          ...commandList.map((cmd) => cmd.toJSON()),
          startCommand.toJSON(),
          mappingCommand.toJSON(),
          tiktokCommand.toJSON(),
          reforgotCommand.toJSON()
      ];

      const uniqueCommands = Array.from(new Map(commandsBody.map(cmd => [cmd.name, cmd])).values());

      logger.info('Updating global slash commands...', { count: uniqueCommands.length });

      // Register ALL commands globally to ensure /reforgot works everywhere
      await rest.put(Routes.applicationCommands(this.config.discord.clientId), { body: uniqueCommands });

      // Also register to Core Server for immediate update (Discord global commands take time)
      if (this.config.discord.coreServerId) {
        await rest.put(Routes.applicationGuildCommands(this.config.discord.clientId, this.config.discord.coreServerId), { body: uniqueCommands });
      }
    } catch (error) {
      logger.error('Slash command registration failed', { error: (error as Error).message });
    }
  }

  private async logServerInfo(): Promise<void> {
    try {
      const guilds = await this.client.guilds.fetch();
      const config = configManager.get();

      logger.info(`Guild Access: Active in ${guilds.size} servers`);

      for (const [id, guild] of guilds) {
        const isCore = id === config.discord.coreServerId;
        logger.info(`- ${guild.name} (${id}) | Core: ${isCore}`);
      }
    } catch (error) {
      logger.warn('Could not fetch guild list');
    }
  }

  async shutdown(exitCode = 0): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Initiating graceful shutdown...');

    try {
      this.client.destroy();
      await database.disconnect();
      logger.info('Shutdown complete.');
      process.exit(exitCode);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

const app = new Application();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  app.shutdown(1);
});

process.on('SIGINT', () => app.shutdown(0));
process.on('SIGTERM', () => app.shutdown(0));

app.start();
