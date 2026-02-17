import '@sapphire/plugin-subcommands/register';
import './container.types'; // Import types augmentation
import { container } from '@sapphire/framework';
import { UserMappingRepository } from './repositories/user-mapping.repository';
import { AccessControlRepository } from './repositories/access-control.repository';
import { SystemConfigRepository } from './repositories/system-config.repository';
import { QueueRepository } from './repositories/queue.repository';
import { PermissionService } from './services/permission.service';
import { ForwarderService } from './services/forwarder.service';
import { QueueService } from './services/queue.service';
import { DownloaderService } from './services/downloader.service';
import { NotificationService } from './services/notification.service';
import { SchedulerService } from './services/scheduler.service';
import { MenuController } from './controllers/menu.controller';
import { MappingController } from './controllers/admin/mapping.controller';
import { ConfigController } from './controllers/admin/config.controller';
import { RoleController } from './controllers/admin/role.controller';
import { DownloadController } from './controllers/download.controller';
import { configManager } from './core/config/config';

// 1. Instantiate Core Repositories
const userMappingRepo = new UserMappingRepository();
const accessControlRepo = new AccessControlRepository();
const systemConfigRepo = new SystemConfigRepository();
const queueRepo = new QueueRepository();

// 2. Instantiate Services
const downloaderService = new DownloaderService(systemConfigRepo);
const notificationService = new NotificationService(userMappingRepo);
const queueService = new QueueService(queueRepo, downloaderService, notificationService, systemConfigRepo);
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
    scheduler: schedulerService
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
