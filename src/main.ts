// src/main.ts
import { Events, Message } from 'discord.js';
import { database } from './infra/database/connection';
import { configManager } from './infra/config/config';
import { logger } from './infra/logger';
import { handleInteractionError } from './shared/utils/error-handler';
import { APP_VERSION } from './shared/constants';
import { DiscordClientWrapper } from './interfaces/discord/client';
import { CommandRegistrar } from './infra/discord/command-registrar';
import { getCommandList } from './interfaces/discord/command-registry';

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
 * Helper function to extract TikTok links from various message parts.
 * Checks Content, Embeds, and Components (Buttons).
 */
function extractTikTokLink(message: Message): string[] {
    const tiktokRegex = /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/[@\w\.\/]+/g;
    const foundUrls: Set<string> = new Set();

    // 1. Cek Content (Text biasa)
    if (message.content) {
        const matches = message.content.match(tiktokRegex);
        if (matches) matches.forEach(url => foundUrls.add(url));
    }

    // 2. Cek Embeds (Description, URL, Fields)
    if (message.embeds?.length > 0) {
        for (const embed of message.embeds) {
            if (embed.description) {
                const matches = embed.description.match(tiktokRegex);
                if (matches) matches.forEach(url => foundUrls.add(url));
            }
            if (embed.url) {
                const matches = embed.url.match(tiktokRegex);
                if (matches) matches.forEach(url => foundUrls.add(url));
            }
        }
    }

    // 3. Cek Components (Buttons dengan URL)
    if (message.components?.length > 0) {
        for (const row of message.components) {
            // Cast row to any to avoid "Property 'components' does not exist on type 'TopLevelComponent'"
            const components = (row as any).components;
            if (components && Array.isArray(components)) {
                for (const component of components) {
                    if (component.url) {
                        const matches = component.url.match(tiktokRegex);
                        if (matches) matches.forEach((url: string) => foundUrls.add(url));
                    }
                }
            }
        }
    }

    return Array.from(foundUrls);
}

/**
 * Main Application Class.
 * Responsible for managing the bot lifecycle, dependency injection, 
 * event routing, and database connections.
 */
class Application {
  private clientWrapper: DiscordClientWrapper;
  
  // Services
  private permissionService!: PermissionService;
  private adminController!: AdminController;
  private tiktokService!: TiktokDownloadService;
  
  // Use Cases
  private getOrProvisionMapping!: GetOrProvisionMappingUseCase;
  private processTiktokLink!: ProcessTiktokLinkUseCase;
  private addMapping!: AddMappingUseCase;
  private removeMapping!: RemoveMappingUseCase;
  private listMappings!: ListMappingsUseCase;

  private commandRegistrar!: CommandRegistrar;

  // Repositories (Needed for sync)
  private systemConfigRepo!: SystemConfigRepository;
  
  // Infrastructure
  private outboxProcessor!: OutboxProcessor;

  private isShuttingDown = false;

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
    
    // Choose Repository Implementation
    const config = configManager.get();
    const mappingRepo = config.database.driver === 'sqlite' 
        ? new SqliteUserMappingRepository() 
        : new PostgresUserMappingRepository();
        
    const tiktokClient = new TiktokApiClient();
    const notifierAdapter = new DiscordNotifierAdapter(this.clientWrapper);
    const loggerAdapter = new WinstonLoggerAdapter();
    const outboxRepo = new OutboxRepository();

    // INITIALIZE REGISTRAR
    this.commandRegistrar = new CommandRegistrar(config);

    // 2. Wiring Domain Events
    const eventBus = DomainEventBus.getInstance();
    const discordHandler = new SendDiscordNotificationHandler(notifierAdapter);
    
    eventBus.register(TikTokVideoForwardedEvent.name, discordHandler);
    
    // Initialize Processor
    this.outboxProcessor = new OutboxProcessor(outboxRepo, eventBus);

    // 3. Application Layer (Domain wiring)
    this.permissionService = new PermissionService(accessRepo);
    this.tiktokService = new TiktokDownloadService(tiktokClient);
    
    // Forwarder DDD Wiring
    this.addMapping = new AddMappingUseCase(mappingRepo);
    this.removeMapping = new RemoveMappingUseCase(mappingRepo);
    this.listMappings = new ListMappingsUseCase(mappingRepo);
    
    // --- NEW: Channel Manager Adapter ---
    const channelManagerAdapter = new DiscordChannelManagerAdapter(this.clientWrapper);
    
    // --- NEW: Provisioning Use Case ---
    this.getOrProvisionMapping = new GetOrProvisionMappingUseCase(
        mappingRepo,
        channelManagerAdapter
    );
    
    // Admin Dashboard Wiring (DDD)
    const configUseCase = new ManageSystemConfigUseCase(this.systemConfigRepo);
    
    this.adminController = new AdminController(
        this.permissionService,
        configUseCase,
        this.addMapping,
        this.removeMapping,
        this.listMappings,
        this.clientWrapper
    );
    
    // NOTE: Notifier is no longer injected here. It's used by the EventHandler.
    this.processTiktokLink = new ProcessTiktokLinkUseCase(
        this.tiktokService,
        this.getOrProvisionMapping, // <--- INJECTED NEW USE CASE
        outboxRepo,
        loggerAdapter
    );
  }

  async start(): Promise<void> {
    try {
      // Load Config (Env)
      const config = configManager.load();
      logger.info(`🚀 Starting TikTok Notification Forwarder Bot v${APP_VERSION}...`);

      // Database Connection
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

      // Bootstrap Dependencies (Now that DB is ready-ish)
      this.bootstrap();

      // --- COMMAND REGISTRATION ---
      logger.info('Registering Slash Commands...');
      const commandList = getCommandList();
      await this.commandRegistrar.register(commandList);
      // ----------------------------

      // Sync System Config (DB <-> Env overrides)
      await this.syncSystemVersion();
      await this.configManagerReload();

      // Setup Event Listeners
      this.setupEventHandlers();

      // Log in
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

    // Message Listener (Auto-forwarding)
    client.on(Events.MessageCreate, async (message) => {
      // LOGIKA BARU:
      // 1. Jika pengirim adalah Bot, CEK apakah dia ada di whitelist SOURCE_BOT_IDS
      const config = configManager.get();
      const isSourceBot = config.bot.sourceBotIds.includes(message.author.id);

      // Jika pesan dari bot TAPI bukan source bot -> abaikan
      if (message.author.bot && !isSourceBot) return;

      // 2. Gunakan ekstraktor link yang lebih pintar
      const urls = extractTikTokLink(message as Message);
      
      if (urls.length > 0) {
        // Logika Forwarder
        for (const url of urls) {
             try {
                // Gunakan tag pengirim asli atau source bot
                await this.processTiktokLink.execute(url, message.author.tag);
             } catch (error) {
                logger.error('Error processing TikTok URL', { url, error });
             }
        }
      }
    });

    // Slash Command & Interaction Listener
    client.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            switch (commandName) {
                case 'admin':
                    await handleAdminAdapter(interaction, this.permissionService);
                    break;
                case 'tiktok':
                    await handleTiktokAdapter(interaction, this.tiktokService);
                    break;
                case 'mapping':
                    await handleForwarderAdapter(
                        interaction,
                        this.addMapping
                    );
                    break;
                case 'menu':
                    await this.adminController.handle(interaction);
                    break;
                default:
                    logger.warn(`Unknown command: ${commandName}`);
            }
        } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            // Route button/modal/menu interactions
            // The Menu uses "nav:" (new) and "nav_" (legacy) prefixes
            if (interaction.customId.startsWith('nav') || interaction.customId.startsWith('admin_') || interaction.customId.startsWith('set') || interaction.customId === 'toggle_autodl') {
                await this.adminController.handle(interaction as any);
            }
        }
      } catch (error) {
        if (interaction.isRepliable()) {
            await handleInteractionError(interaction as any, error as Error);
        }
      }
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

const app = new Application();

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