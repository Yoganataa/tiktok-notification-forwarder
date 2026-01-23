import 'dotenv/config';
import { Client, GatewayIntentBits, Events, REST, Routes, ActivityType, ChatInputCommandInteraction } from 'discord.js';
import { database } from './core/database/connection';
import { configManager } from './core/config/config';
import { logger } from './shared/utils/logger';
import { handleInteractionError } from './shared/utils/error-handler';
import { commandRegistry } from './features/commands.registry';

// Controllers & Handlers (Refactored commands will be loaded automatically)
import { handleMappingCommand } from './features/mapping/mapping.command';
import { handleMenuCommand } from './features/menu/menu.command';
import { handleAdminCommand } from './features/admin/admin.command';
// handleTikTokCommand is now inside TikTokCommand.execute()
import { handleStartCommand } from './features/start/start.command';
// handleReforgotCommand is now inside ReforgotCommand.execute()
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
import { BaseCommand } from './core/contracts/module.contract';

class Application {
  private client: Client;
  private config: ReturnType<typeof configManager.get>;
  private forwarderService: ForwarderService;
  private queueService: QueueService;
  private permissionService: PermissionService;
  private menuController: MenuController;
  private systemConfigRepo: SystemConfigRepository;
  private isShuttingDown = false;

  // NOTE: In a full DI system, these would be managed by a container.
  // We keep them here for legacy handler support during migration.
  public services: any = {};

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

    // Store services for legacy access if needed
    this.services = {
        permissionService: this.permissionService,
        forwarderService: this.forwarderService
    };

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting TikTok Notification Forwarder Bot...');

      await StartupService.init();

      // Initialize Dynamic Modules
      await commandRegistry.init();
      // DownloaderService now lazy loads or we can init here if we change its design,
      // but strictly speaking the service instance created in constructor has its own lifecycle.
      // The DownloaderService refactor handles its own module loading on init or first use if we added an init method.
      // But let's look at how we instantiated it: `new DownloaderService(...)`.
      // We added an `init()` method to it. We should call it.
      await (this.queueService as any)['downloader'].init(); // Access private prop or cast.
      // Actually queueService.downloader is private.
      // In the refactor `DownloaderService` had an `init()` added.
      // We should probably call it on the instance we created.
      // Let's fix this cleanly:
      const dlService = (this.queueService as any).downloader as DownloaderService;
      if (dlService && typeof dlService.init === 'function') {
          await dlService.init();
      }

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

  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    // Only block commands if it's NOT the 'reforgot' command
    // Note: With dynamic loading, we might want to move this check into the command itself or a middleware
    if (interaction.commandName !== 'reforgot' && interaction.guildId !== this.config.discord.coreServerId) {
        await interaction.reply({ content: '⛔ Commands are only available in the Core Server.', ephemeral: true });
        return;
    }

    // Try to find command in registry
    const command = commandRegistry.getCommands().find(cmd => cmd.definition.name === interaction.commandName);

    if (command) {
        await command.execute(interaction);
        return;
    }

    // Fallback to legacy handlers if not found in registry (e.g. if we didn't migrate everything yet)
    switch (interaction.commandName) {
      case 'mapping': await handleMappingCommand(interaction, this.permissionService); break;
      case 'menu': await handleMenuCommand(interaction, this.permissionService); break;
      case 'admin': await handleAdminCommand(interaction, this.permissionService); break;
      // tiktok and reforgot are now dynamic, start is likely dynamic too or legacy
      case 'start': await handleStartCommand(interaction); break;
    }
  }

  private async registerCommands(): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(this.config.discord.token);

      // Get definitions from registry
      const commandsBody = commandRegistry.getDefinitions().map(def => def.toJSON());

      // Add legacy commands if they are NOT in the registry yet
      // For this refactor, we migrated tiktok and reforgot.
      // We should check duplicates.
      const legacyCommands = [
          // startCommand.toJSON(),
          // mappingCommand.toJSON(),
          // ...
      ];
      // Actually, since we didn't migrate ALL commands in the plan (only examples),
      // we need to merge them.
      // But wait, the plan said "Refactor Command Registration... Into an automatic registry".
      // We implemented the registry. Modules that are NOT .command.ts files won't be loaded.
      // mapping, menu, admin, start are NOT migrated to class-based .command.ts yet in this turn.
      // So we must manually include them from the old list, filtering out what we replaced.

      const { commandList: legacyList } = require('./features/commands.registry'); // We overwrote this file?
      // Wait, we overwrote src/features/commands.registry.ts with the new Class registry!
      // This means we LOST the legacy exports if we didn't migrate them.
      // CRITICAL: The plan was "Refactor Command Registration".
      // If we didn't migrate Mapping/Menu/Admin/Start to classes, they are lost from the registry.
      // I need to ensure `handleSlashCommand` fallback works, but `registerCommands` needs the JSON.

      // Since I overwrote the registry file, I can't import the old list.
      // I must manually import the legacy commands here to restore them for registration.
      // The legacy commands were: mapping, menu, admin, start.
      const { mappingCommand } = require('./features/mapping/mapping.command');
      const { menuCommand } = require('./features/menu/menu.command');
      const { adminCommand } = require('./features/admin/admin.command');
      const { startCommand } = require('./features/start/start.command');

      const legacyDefs = [mappingCommand, menuCommand, adminCommand, startCommand].map(c => c.toJSON());

      // Merge: Registry (Dynamic) + Legacy
      const allCommands = [
          ...commandsBody,
          ...legacyDefs
      ];

      // Deduplicate by name
      const uniqueCommands = Array.from(new Map(allCommands.map(cmd => [cmd.name, cmd])).values());

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
