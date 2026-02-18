import { PermissionService } from '../services/permission.service';
import { ForwarderService } from '../../discord/services/forwarder.service';
import { QueueService } from '../services/queue.service';
import { DownloaderService } from '../downloader/downloader.service';
import { DiscordNotificationService } from '../../discord/services/notification.service';
import { SchedulerService } from '../../discord/services/scheduler.service';
import { TelegramService } from '../../telegram/services/telegram.service';
import { UserMappingRepository } from '../repositories/user-mapping.repository';
import { AccessControlRepository } from '../repositories/access-control.repository';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { QueueRepository } from '../repositories/queue.repository';
import { MenuController } from '../../discord/controllers/menu.controller';
import { MappingController } from '../../discord/controllers/admin/mapping.controller';
import { ConfigController } from '../../discord/controllers/admin/config.controller';
import { RoleController } from '../../discord/controllers/admin/role.controller';
import { DownloadController } from '../../discord/controllers/download.controller';
import { TelegramLoginController } from '../../discord/controllers/admin/telegram-login.controller';

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
            notification: DiscordNotificationService;
            scheduler: SchedulerService;
            telegram: TelegramService;
        };
        controllers: {
            menu: MenuController;
            mapping: MappingController;
            config: ConfigController;
            role: RoleController;
            download: DownloadController;
            telegramLogin: TelegramLoginController;
        };
    }
}
