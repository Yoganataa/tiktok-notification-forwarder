import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { configManager } from './core/config/config';
import { logger } from './shared/utils/logger';
import { DatabaseService } from './core/database/connection';
import { MigrationService } from './core/services/migration.service';
import { StartupService } from './core/services/startup.service';
import { ForwarderService } from './features/forwarder/forwarder.service';
import { NotificationService } from './features/notification/notification.service';
import { SystemConfigRepository } from './core/repositories/system-config.repository';
import { UserMappingRepository } from './core/repositories/user-mapping.repository';
import { QueueRepository } from './core/repositories/queue.repository';
import { QueueService } from './features/queue/queue.service';
import { DownloaderService } from './features/downloader/downloader.service';
import { PermissionService } from './features/admin/permission.service';
import { MenuController } from './features/menu/menu.controller';
import { handleMappingCommand, mappingCommand } from './features/mapping/mapping.command';
import { handleStartCommand, startCommand } from './features/start/start.command';
import { handleTikTokCommand, tiktokCommand } from './features/tiktok/tiktok.command';

export class Application {
  private client: Client;
  private db: DatabaseService;
  private forwarder: ForwarderService;
  private queueService: QueueService;
  private menuController: MenuController;
  private permissionService: PermissionService;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.db = new DatabaseService();

    // Repositories
    const systemConfigRepo = new SystemConfigRepository();
    const userMappingRepo = new UserMappingRepository();
    const queueRepo = new QueueRepository();

    // Services
    const notificationService = new NotificationService();
    const downloaderService = new DownloaderService(systemConfigRepo);
    this.permissionService = new PermissionService();

    this.queueService = new QueueService(queueRepo, downloaderService, notificationService, systemConfigRepo);

    this.forwarder = new ForwarderService(
      userMappingRepo,
      queueRepo,
      systemConfigRepo
    );

    this.menuController = new MenuController(
        this.permissionService,
        systemConfigRepo,
        userMappingRepo,
        async () => { await this.reloadConfig(); }
    );
  }

  async start() {
    try {
      logger.info('🚀 Starting TikTok Notification Forwarder Bot...');

      // 1. Initialize System Services
      await StartupService.init();

      // 2. Database Connection
      await this.db.connect();

      // 3. Run Migrations
      const migrationService = new MigrationService(this.db);
      await migrationService.runMigrations();

      // 4. Load Dynamic Config
      await this.reloadConfig();

      // 5. Discord Login
      await this.client.login(configManager.get().bot.token);

      this.client.once('ready', async () => {
        logger.info(`✅ Bot authenticated as ${this.client.user?.tag}`);
        await this.registerCommands();

        // Start Queue Worker
        setInterval(() => this.queueService.processQueue(this.client), 5000);
      });

      this.client.on('messageCreate', (message) => {
        this.forwarder.handleMessage(message);
      });

      this.client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'start') {
                await handleStartCommand(interaction);
            } else if (interaction.commandName === 'mapping') {
                await handleMappingCommand(interaction, this.permissionService);
            } else if (interaction.commandName === 'tiktok') {
                await handleTikTokCommand(interaction, this.permissionService, this.queueService['downloader']);
            }
        } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('map_') ||
                interaction.customId.startsWith('btn_') ||
                interaction.customId.startsWith('modal_') ||
                interaction.customId.startsWith('nav_') ||
                interaction.customId.startsWith('select_') ||
                interaction.customId.startsWith('role_')) {

                if (interaction.isModalSubmit()) {
                    await this.menuController.handleModal(interaction);
                } else if (interaction.isStringSelectMenu()) {
                    await this.menuController.handleSelectMenu(interaction);
                } else if (interaction.isButton()) {
                    await this.menuController.handleButton(interaction);
                }
            }
        }
      });

    } catch (error) {
      logger.error('Failed to start application', { error });
      process.exit(1);
    }
  }

  private async reloadConfig() {
      const systemConfigRepo = new SystemConfigRepository();
      const overrides = await systemConfigRepo.getAll();
      configManager.update(overrides);
      logger.info(`Dynamic configuration: ${Object.keys(overrides).length} values overridden successfully.`);
  }

  private async registerCommands() {
      const guildId = configManager.get().discord.coreServerId;
      if (!guildId) return;

      const guild = this.client.guilds.cache.get(guildId);
      if (guild) {
          logger.info('Updating global slash commands...');
          await guild.commands.set([
              startCommand,
              mappingCommand,
              tiktokCommand
          ]);
      }
  }
}

const app = new Application();
app.start();
