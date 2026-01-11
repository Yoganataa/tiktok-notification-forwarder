import { DownloadResult } from '../../tiktok/domain';

export interface NotifierPort {
  notify(channelId: string, message: string, media?: DownloadResult, roleIdToTag?: string | null, eventId?: string): Promise<void>;
}
