import { IEventHandler } from '../../../../shared/domain/events/event-handler';
import { TikTokVideoForwardedEvent } from '../../domain/events/tiktok-video-forwarded.event';
import { NotifierPort } from '../../ports/notifier.port';
import { logger } from '../../../../infra/logger';
import { configManager } from '../../../../infra/config/config';

export class SendDiscordNotificationHandler implements IEventHandler<TikTokVideoForwardedEvent> {
  constructor(private readonly notifier: NotifierPort) {}

  async handle(event: TikTokVideoForwardedEvent): Promise<void> {
    const { mapping, media, originalUrl, sourceGuildName } = event;
    logger.info(`Handling event: TikTokVideoForwardedEvent for user ${mapping.username} -> channel ${mapping.channelId}`);

    // --- DOWNLOADER LOGIC ---
    const isDownloaderEnabled = configManager.get().bot.enableDownloader;
    const hasMedia = media && (media.urls.length > 0);

    let messageContent = `🎥 **New Post by @${media.author}!**`;

    if (isDownloaderEnabled && hasMedia) {
        // Downloader ON + Media Present: Clean message
        messageContent = `🎥 **New Post by @${media.author}!**`;
    } else {
        // Downloader OFF or No Media: Include link
        messageContent = `🎥 **New Post by @${media.author}!**\n<${originalUrl}>`;
    }

    try {
      await this.notifier.notify(
        mapping.channelId,
        messageContent,
        media,
        mapping.roleIdToTag,
        event.eventId,
        sourceGuildName
      );
    } catch (error) {
      logger.error(`Failed to notify channel ${mapping.channelId} for event TikTokVideoForwardedEvent`, { error: (error as Error).message });
    }
  }
}
