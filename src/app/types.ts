import { PermissionService } from '../domain/permission.service';
import { ForwarderService } from '../domain/forwarder.service';
import { QueueService } from '../domain/queue.service';
import { DownloaderService } from '../domain/downloader.service';
import { NotificationService } from '../domain/notification.service';
import { UserMappingRepository } from '../infrastructure/repositories/user-mapping.repository';
import { AccessControlRepository } from '../infrastructure/repositories/access-control.repository';
import { SystemConfigRepository } from '../infrastructure/repositories/system-config.repository';
import { QueueRepository } from '../infrastructure/repositories/queue.repository';
import { MenuInteraction } from '../presentation/interactions/menu.interaction';

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
            menu: MenuInteraction;
        };
    }
}
