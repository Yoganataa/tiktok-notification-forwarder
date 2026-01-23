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
import { handleStartCommand } from './features/start/start.command';
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

      // Initialize Downloader Service (loads engines)
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
    // Basic Guild Guard
    if (!interaction.guildId) {
        await interaction.reply({ content: '⛔ Commands are not available in DMs.', ephemeral: true });
        return;
    }

    // Command Scoping Guard:
    // - reforgot: Allowed in ANY guild (Global)
    // - others: Allowed ONLY in Core Server
    if (interaction.commandName !== 'reforgot' && interaction.guildId !== this.config.discord.coreServerId) {
        await interaction.reply({ content: '⛔ Commands are only available in the Core Server.', ephemeral: true });
        return;
    }

    const command = commandRegistry.getCommands().find(cmd => cmd.definition.name === interaction.commandName);

    if (command) {
        await command.execute(interaction);
        return;
    }

    switch (interaction.commandName) {
      case 'mapping': await handleMappingCommand(interaction, this.permissionService); break;
      case 'menu': await handleMenuCommand(interaction, this.permissionService); break;
      case 'admin': await handleAdminCommand(interaction, this.permissionService); break;
      case 'start': await handleStartCommand(interaction); break;
    }
  }

  private async registerCommands(): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(this.config.discord.token);

      // 1. Get Dynamic Commands (Reforgot, TikTok, etc.)
      const dynamicDefs = commandRegistry.getDefinitions().map(def => def.toJSON());

      // 2. Get Legacy Commands
      const { mappingCommand } = require('./features/mapping/mapping.command');
      const { menuCommand } = require('./features/menu/menu.command');
      const { adminCommand } = require('./features/admin/admin.command');
      const { startCommand } = require('./features/start/start.command');

      const legacyDefs = [mappingCommand, menuCommand, adminCommand, startCommand].map(c => c.toJSON());

      // 3. Merge and Unique
      const allCommands = [...dynamicDefs, ...legacyDefs];
      const uniqueCommands = Array.from(new Map(allCommands.map(cmd => [cmd.name, cmd])).values());

      // 4. Apply DM Permission = False to ALL commands
      uniqueCommands.forEach(cmd => {
          cmd.dm_permission = false; // Disable DMs

          // Force Guild Only context (Contexts: 0=Guild, 1=BotDM, 2=GDM)
          // @ts-ignore - DiscordJS types might lag behind raw API payload
          cmd.contexts = [0];
          // Force Guild Install Only (IntegrationTypes: 0=Guild, 1=User)
          // @ts-ignore
          cmd.integration_types = [0];
      });

      // 5. Separate Scopes
      const globalCommands = uniqueCommands.filter(cmd => cmd.name === 'reforgot');
      const guildCommands = uniqueCommands.filter(cmd => cmd.name !== 'reforgot');

      logger.info(`Registering Global Commands: ${globalCommands.map(c => c.name).join(', ')}`);
      await rest.put(Routes.applicationCommands(this.config.discord.clientId), { body: globalCommands });

      if (this.config.discord.coreServerId) {
        logger.info(`Registering Core Guild Commands: ${guildCommands.map(c => c.name).join(', ')}`);
        await rest.put(Routes.applicationGuildCommands(this.config.discord.clientId, this.config.discord.coreServerId), { body: guildCommands });
      } else {
          logger.warn('No CORE_SERVER_ID defined. Guild commands skipped.');
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
