import { IEventHandler } from '../../../../shared/domain/events/event-handler';
import { TikTokVideoForwardedEvent } from '../../domain/events/tiktok-video-forwarded.event';
import { NotifierPort } from '../../ports/notifier.port';
import { logger } from '../../../../infra/logger';

export class SendDiscordNotificationHandler implements IEventHandler<TikTokVideoForwardedEvent> {
  constructor(private readonly notifier: NotifierPort) {}

  async handle(event: TikTokVideoForwardedEvent): Promise<void> {
    const { mapping, media, originalUrl } = event;
    logger.info(`Handling event: TikTokVideoForwardedEvent for user ${mapping.username} -> channel ${mapping.channelId}`);

    try {
      await this.notifier.notify(
        mapping.channelId,
        `🎥 **New Post by @${media.author}!**\n<${originalUrl}>`,
        media,
        mapping.roleIdToTag,
        event.eventId
      );
    } catch (error) {
      logger.error(`Failed to notify channel ${mapping.channelId} for event TikTokVideoForwardedEvent`, { error: (error as Error).message });
      // In a real system, we might want to re-throw or rely on a retry mechanism mechanism if this handler is critical.
      // For now, logging error is consistent with previous behavior.
    }
  }
}
