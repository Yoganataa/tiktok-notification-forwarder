import { Events, Message } from 'discord.js';
import { database } from './infra/database/connection';
import { configManager } from './infra/config/config';
import { logger } from './infra/logger';
import { APP_VERSION } from './shared/constants';
import { DiscordClientWrapper } from './interfaces/discord/client';
import { CommandRegistrar } from './infra/discord/command-registrar';
import { CommandDispatcher } from './infra/discord/command-dispatcher';
import { getCommandList } from './interfaces/discord/command-registry';
import { extractTikTokLink } from './shared/utils/tiktok-extractor';

// --- INFRASTRUCTURE (REPOSITORIES & ADAPTERS) ---
import { AccessControlRepository } from './modules/admin/infra/admin.repository';
import { ManageSystemConfigUseCase } from './modules/admin/application/usecases/manage-system-config.usecase';
import { SystemConfigRepository } from './modules/admin/infra/system-config.repository';
import { SqliteUserMappingRepository } from './modules/forwarder/adapters/database/sqlite-user-mapping.repository';
import { WinstonLoggerAdapter } from './modules/forwarder/adapters/logger/winston-logger.adapter';
import { PostgresUserMappingRepository } from './modules/forwarder/adapters/database/postgres-user-mapping.repository';
import { TiktokApiClient } from './modules/tiktok/infra/tiktok-api.client';
import { DiscordNotifierAdapter } from './modules/forwarder/infra/discord-notifier.adapter';
import { DiscordChannelManagerAdapter } from './modules/forwarder/infra/discord-channel-manager.adapter';

// --- APPLICATION SERVICES & USE CASES ---
import { PermissionService } from './modules/admin/application/admin.service';
import { TiktokDownloadService } from './modules/tiktok/application/tiktok.service';
import { ProcessTiktokLinkUseCase } from './modules/forwarder/application/usecases/process-tiktok-link.usecase';
import { GetOrProvisionMappingUseCase } from './modules/forwarder/application/usecases/get-or-provision-mapping.usecase';
import { AddMappingUseCase } from './modules/forwarder/application/usecases/add-mapping.usecase';
import { RemoveMappingUseCase } from './modules/forwarder/application/usecases/remove-mapping.usecase';
import { ListMappingsUseCase } from './modules/forwarder/application/usecases/list-mappings.usecase';

// --- INTERFACE ADAPTERS (DISCORD HANDLERS) ---
import { handleAdminAdapter } from './modules/admin/interface/admin.discord.adapter';
import { AdminController } from './modules/admin/interface/discord/dashboard/admin.controller';
import { handleTiktokAdapter } from './modules/tiktok/interface/tiktok.discord.adapter';
import { handleForwarderAdapter } from './modules/forwarder/interface/forwarder.discord.adapter';

// --- GLOBAL INFRA ---
import { MigrationService } from './infra/migrations/migration.service';

// Domain Events
import { DomainEventBus } from './shared/domain/events/domain-event-bus';
import { TikTokVideoForwardedEvent } from './modules/forwarder/domain/events/tiktok-video-forwarded.event';
import { SendDiscordNotificationHandler } from './modules/forwarder/application/handlers/send-discord-notification.handler';

// Outbox
import { OutboxRepository } from './shared/infra/outbox/outbox.repository';
import { OutboxProcessor } from './shared/infra/outbox/outbox-processor';
import { withTransaction } from './infra/database/transaction';

/**
 * Main Application Class.
 */
export class Application {
  private clientWrapper: DiscordClientWrapper;
  private commandRegistrar!: CommandRegistrar;
  private commandDispatcher!: CommandDispatcher;

  // Repositories
  private systemConfigRepo!: SystemConfigRepository;

  // Infrastructure
  private outboxProcessor!: OutboxProcessor;
  private isShuttingDown = false;

  // Use Cases (for Event Handlers)
  private processTiktokLink!: ProcessTiktokLinkUseCase;

  constructor() {
    this.clientWrapper = new DiscordClientWrapper();
  }

  /**
   * Initialize and wire all dependencies.
   */
  private bootstrap(): void {
    // 1. Infrastructure Layer
    this.systemConfigRepo = new SystemConfigRepository();
    const accessRepo = new AccessControlRepository();

    const config = configManager.get();
    const mappingRepo = config.database.driver === 'sqlite'
        ? new SqliteUserMappingRepository()
        : new PostgresUserMappingRepository();

    const tiktokClient = new TiktokApiClient();
    const notifierAdapter = new DiscordNotifierAdapter(this.clientWrapper);
    const loggerAdapter = new WinstonLoggerAdapter();
    const outboxRepo = new OutboxRepository();
    const channelManagerAdapter = new DiscordChannelManagerAdapter(this.clientWrapper);

    // 2. Wiring Domain Events
    const eventBus = DomainEventBus.getInstance();
    const discordHandler = new SendDiscordNotificationHandler(notifierAdapter);

    // Register Event Handlers
    // Ensure we don't register duplicates if bootstrap is called multiple times (though it shouldn't be)
    eventBus.register(TikTokVideoForwardedEvent.name, discordHandler);

    // Initialize Outbox Processor
    this.outboxProcessor = new OutboxProcessor(outboxRepo, eventBus);
    // Start Outbox (non-blocking)
    this.outboxProcessor.start();

    // 3. Application Services
    const permissionService = new PermissionService(accessRepo);
    const tiktokService = new TiktokDownloadService(tiktokClient);

    // Forwarder Use Cases
    const addMapping = new AddMappingUseCase(mappingRepo);
    const removeMapping = new RemoveMappingUseCase(mappingRepo);
    const listMappings = new ListMappingsUseCase(mappingRepo);

    const getOrProvisionMapping = new GetOrProvisionMappingUseCase(
        mappingRepo,
        channelManagerAdapter
    );

    // Config Use Cases
    const configUseCase = new ManageSystemConfigUseCase(this.systemConfigRepo);

    // Controllers
    const adminController = new AdminController(
        permissionService,
        configUseCase,
        addMapping,
        removeMapping,
        listMappings,
        this.clientWrapper
    );

    this.processTiktokLink = new ProcessTiktokLinkUseCase(
        tiktokService,
        getOrProvisionMapping,
        outboxRepo,
        loggerAdapter
    );

    // 4. Command Registry & Dispatching
    this.commandRegistrar = new CommandRegistrar(config);
    this.commandDispatcher = new CommandDispatcher();

    // Register Slash Commands
    this.commandDispatcher.registerSlash('admin', (i) => handleAdminAdapter(i, permissionService));
    this.commandDispatcher.registerSlash('tiktok', (i) => handleTiktokAdapter(i, tiktokService));
    this.commandDispatcher.registerSlash('mapping', (i) => handleForwarderAdapter(i, addMapping));
    this.commandDispatcher.registerSlash('menu', (i) => adminController.handle(i));

    // Register Components (Prefixes)
    // "nav:", "admin_", "set", "toggle_autodl" are used by AdminController
    this.commandDispatcher.registerComponentPrefix('nav', (i) => adminController.handle(i as any));
    this.commandDispatcher.registerComponentPrefix('admin_', (i) => adminController.handle(i as any));
    this.commandDispatcher.registerComponentPrefix('set', (i) => adminController.handle(i as any));
    this.commandDispatcher.registerComponent('toggle_autodl', (i) => adminController.handle(i as any));
  }

  async start(): Promise<void> {
    try {
      const config = configManager.load();
      logger.info(`🚀 Starting TikTok Notification Forwarder Bot v${APP_VERSION}...`);

      // Database
      await database.connect({
        driver: config.database.driver,
        connectionString: config.database.url,
        ssl: config.database.ssl,
        maxConnections: config.database.maxConnections,
        minConnections: config.database.minConnections,
      });

      // Migrations
      const migrationService = new MigrationService();
      await migrationService.run();

      // Bootstrap
      this.bootstrap();

      // Command Registration (Discord API)
      logger.info('Registering Slash Commands...');
      const commandList = getCommandList();
      await this.commandRegistrar.register(commandList);

      // Sync Version
      await this.syncSystemVersion();

      // Reload Dynamic Config
      await this.configManagerReload();

      // Event Listeners
      this.setupEventHandlers();

      // Login
      await this.clientWrapper.login(config.discord.token);

    } catch (error) {
      logger.error('❌ Critical failure during application startup', {
        error: (error as Error).message
      });
      await this.shutdown(1);
    }
  }

  private async syncSystemVersion(): Promise<void> {
    try {
      const currentDbVersion = await this.systemConfigRepo.get('VERSION');
      if (currentDbVersion !== APP_VERSION) {
        logger.info(`Updating system version in DB: ${currentDbVersion} -> ${APP_VERSION}`);
        await withTransaction(async (tx) => {
            await this.systemConfigRepo.set('VERSION', APP_VERSION, tx);
        });
      }
    } catch (error) {
      logger.warn('Failed to sync version to database', { error: (error as Error).message });
    }
  }

  private async configManagerReload(): Promise<void> {
    try {
      await configManager.loadFromDatabase(this.systemConfigRepo);
    } catch (error) {
      logger.error('Failed to synchronize dynamic configuration', {
        error: (error as Error).message
      });
    }
  }

  private setupEventHandlers(): void {
    const client = this.clientWrapper.client;

    client.once(Events.ClientReady, async (readyClient) => {
      logger.info(`✅ Bot authenticated as ${readyClient.user.tag}`);
      await this.logServerInfo();
    });

    // Optimized Message Listener
    client.on(Events.MessageCreate, async (message) => {
      // 1. Check Source Bot Whitelist
      const config = configManager.get();
      if (message.author.bot) {
          if (!config.bot.sourceBotIds.includes(message.author.id)) return;
      }

      // 2. Extract Links (Optimized)
      const urls = extractTikTokLink(message as Message);

      if (urls.length > 0) {
        // --- NEW: Detect Server Context for Attribution ---
        let sourceGuildName: string | undefined = undefined;
        if (message.guild) {
             // If this bot is in another server, we capture that server's name.
             // We can check against Core ID, but just passing the name is safer/simpler for now.
             // If it's the Core Server, the notifier will still append "From Server: X" if we pass it,
             // but usually we want to skip it if it's the main server.
             if (message.guild.id !== config.discord.coreServerId) {
                 sourceGuildName = message.guild.name;
             }
        }

        for (const url of urls) {
             try {
                // Pass sourceGuildName to Use Case
                await this.processTiktokLink.execute(url, message.author.tag, sourceGuildName);
             } catch (error) {
                logger.error('Error processing TikTok URL', { url, error });
             }
        }
      }
    });

    // Optimized Interaction Listener
    client.on(Events.InteractionCreate, async (interaction) => {
        await this.commandDispatcher.dispatch(interaction);
    });
  }

  private async logServerInfo(): Promise<void> {
    try {
       const guilds = this.clientWrapper.client.guilds.cache;
       logger.info(`Active in ${guilds.size} guilds.`);
    } catch (error) { /* ignore */ }
  }

  async shutdown(exitCode = 0): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Initiating graceful shutdown...', { exitCode });
    try {
      if (this.outboxProcessor) {
          this.outboxProcessor.stop();
      }
      await database.disconnect();
      this.clientWrapper.destroy();
      logger.info('Graceful shutdown completed successfully.');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown procedure', { error: (error as Error).message });
      process.exit(1);
    }
  }
}
