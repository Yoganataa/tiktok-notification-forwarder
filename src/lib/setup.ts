import '@sapphire/plugin-subcommands/register';
import './types'; // Import types augmentation
import { container } from '@sapphire/framework';
import { UserMappingRepository } from '../core/repositories/user-mapping.repository';
import { AccessControlRepository } from '../core/repositories/access-control.repository';
import { SystemConfigRepository } from '../core/repositories/system-config.repository';
import { QueueRepository } from '../core/repositories/queue.repository';
import { PermissionService } from '../features/admin/permission.service';
import { ForwarderService } from '../features/forwarder/forwarder.service';
import { QueueService } from '../features/queue/queue.service';
import { DownloaderService } from '../features/downloader/downloader.service';
import { NotificationService } from '../features/notification/notification.service';
import { MenuController } from '../features/menu/menu.controller';
import { configManager } from '../core/config/config';

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

// 3. Instantiate Controllers
const configManagerReload = async () => {
    await configManager.loadFromDatabase(systemConfigRepo);
};

const menuController = new MenuController(
    permissionService,
    systemConfigRepo,
    userMappingRepo,
    configManagerReload
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
    notification: notificationService
};

container.controllers = {
    menu: menuController
};

export const initServices = async () => {
    await downloaderService.init();
};
