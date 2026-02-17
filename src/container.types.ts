import { PermissionService } from './services/permission.service';
import { ForwarderService } from './services/forwarder.service';
import { QueueService } from './services/queue.service';
import { DownloaderService } from './services/downloader.service';
import { NotificationService } from './services/notification.service';
import { SchedulerService } from './services/scheduler.service';
import { UserMappingRepository } from './repositories/user-mapping.repository';
import { AccessControlRepository } from './repositories/access-control.repository';
import { SystemConfigRepository } from './repositories/system-config.repository';
import { QueueRepository } from './repositories/queue.repository';
import { MenuController } from './controllers/menu.controller';
import { MappingController } from './controllers/admin/mapping.controller';
import { ConfigController } from './controllers/admin/config.controller';
import { RoleController } from './controllers/admin/role.controller';
import { DownloadController } from './controllers/download.controller';

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
            scheduler: SchedulerService;
        };
        controllers: {
            menu: MenuController;
            mapping: MappingController;
            config: ConfigController;
            role: RoleController;
            download: DownloadController;
        };
    }
}
