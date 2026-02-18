import '@sapphire/plugin-subcommands/register';
import './core/types/container.types'; // Import types augmentation
import { container } from '@sapphire/framework';
import { UserMappingRepository } from './core/repositories/user-mapping.repository';
import { AccessControlRepository } from './core/repositories/access-control.repository';
import { SystemConfigRepository } from './core/repositories/system-config.repository';
import { QueueRepository } from './core/repositories/queue.repository';
import { PermissionService } from './core/services/permission.service';
import { ForwarderService } from './discord/services/forwarder.service';
import { QueueService } from './core/services/queue.service';
import { DownloaderService } from './core/downloader/downloader.service';
import { DiscordNotificationService } from './discord/services/notification.service';
import { SchedulerService } from './discord/services/scheduler.service';
import { TelegramService } from './telegram/services/telegram.service';
import { MenuController } from './discord/controllers/menu.controller';
import { MappingController } from './discord/controllers/admin/mapping.controller';
import { ConfigController } from './discord/controllers/admin/config.controller';
import { RoleController } from './discord/controllers/admin/role.controller';
import { DownloadController } from './discord/controllers/download.controller';
import { configManager } from './core/config/config';
import { logger } from './core/utils/logger';

// 1. Instantiate Core Repositories
const userMappingRepo = new UserMappingRepository();
const accessControlRepo = new AccessControlRepository();
const systemConfigRepo = new SystemConfigRepository();
const queueRepo = new QueueRepository();

// 2. Instantiate Services
const downloaderService = new DownloaderService(systemConfigRepo);
const notificationService = new DiscordNotificationService(userMappingRepo);

// Initial load to get telegram config
configManager.load();
const config = configManager.get();

// Pass the telegram config (which now includes session, not botToken)
const telegramService = new TelegramService(logger, userMappingRepo, config.telegram);

const queueService = new QueueService(queueRepo, downloaderService, notificationService, telegramService, systemConfigRepo);
const permissionService = new PermissionService(accessControlRepo);
const forwarderService = new ForwarderService(notificationService, queueService, userMappingRepo);
const schedulerService = new SchedulerService();

// 3. Instantiate Controllers
const configManagerReload = async () => {
    await configManager.loadFromDatabase(systemConfigRepo);
};

const mappingController = new MappingController(userMappingRepo);
const configController = new ConfigController(systemConfigRepo, configManagerReload);
const roleController = new RoleController(permissionService);
const downloadController = new DownloadController();

const menuController = new MenuController(
    permissionService,
    systemConfigRepo,
    userMappingRepo,
    configController,
    mappingController,
    roleController
);

// 4. Register to Sapphire Container
container.repos = {
    userMapping: userMappingRepo,
    accessControl: accessControlRepo,
    systemConfig: systemConfigRepo,
    queue: queueRepo
};

container.services = {
    permission: permissionService,
    forwarder: forwarderService,
    queue: queueService,
    downloader: downloaderService,
    notification: notificationService,
    scheduler: schedulerService,
    telegram: telegramService
};

container.controllers = {
    menu: menuController,
    mapping: mappingController,
    config: configController,
    role: roleController,
    download: downloadController
};

export const initServices = async () => {
    await downloaderService.init();
};
