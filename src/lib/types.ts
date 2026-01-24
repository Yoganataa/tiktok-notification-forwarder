import { PermissionService } from '../features/admin/permission.service';
import { ForwarderService } from '../features/forwarder/forwarder.service';
import { QueueService } from '../features/queue/queue.service';
import { DownloaderService } from '../features/downloader/downloader.service';
import { NotificationService } from '../features/notification/notification.service';
import { UserMappingRepository } from '../core/repositories/user-mapping.repository';
import { AccessControlRepository } from '../core/repositories/access-control.repository';
import { SystemConfigRepository } from '../core/repositories/system-config.repository';
import { QueueRepository } from '../core/repositories/queue.repository';
import { MenuController } from '../features/menu/menu.controller';

declare module '@sapphire/pieces' {
    interface Container {
        repos: {
            userMapping: UserMappingRepository;
            accessControl: AccessControlRepository;
            systemConfig: SystemConfigRepository;
            queue: QueueRepository;
        };
        services: {
            permission: PermissionService;
            forwarder: ForwarderService;
            queue: QueueService;
            downloader: DownloaderService;
            notification: NotificationService;
        };
        controllers: {
            menu: MenuController;
        };
    }
}
