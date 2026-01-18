import { Message, Client, ChannelType } from 'discord.js';
import { NotificationService } from './notification.service';
import { QueueService } from './queue.service';
import { UserMappingRepository } from '../repositories/user-mapping.repository';
import { configManager } from '../core/config/config';
import { logger } from '../utils/logger';
import { REACTION_EMOJIS } from '../constants';

/**
 * Service responsible for orchestrating the notification forwarding flow.
 * * Intercepts incoming Discord messages, filters them, and routes valid
 * TikTok notifications to the appropriate destination channels within the Core Server.
 */
export class ForwarderService {
  constructor(
    private notificationService: NotificationService,
    private queueService: QueueService,
    private userMappingRepo: UserMappingRepository
  ) {}

  /**
   * Main entry point for processing incoming Discord messages.
   * * Filters messages to ensure they originate from authorized source bots.
   * * Parses content to extract TikTok notification data.
   * * Determines the routing strategy based on the message's origin (Core vs. External Server).
   * * @param message - The raw Discord message object to process.
   */
  async processMessage(message: Message): Promise<void> {
    const config = configManager.get();

    // Guard Clause: Only process messages from configured source bots
    if (!config.bot.sourceBotIds.includes(message.author.id)) {
      return;
    }

    const notification = this.notificationService.extractNotification(message);
    if (!notification || !notification.url) {
      return;
    }

    const isFromCoreServer = message.guildId === config.discord.coreServerId;

    logger.info('TikTok notification detected', {
      username: notification.username,
      type: notification.type,
      guildId: message.guildId,
      guildName: message.guild?.name,
      isFromCoreServer,
    });

    try {
      let channelId: string;
      let roleId: string | null = null;

      const mapping = await this.userMappingRepo.findByUsername(notification.username);

      if (mapping) {
          channelId = mapping.channel_id;
          roleId = mapping.role_id || null;
      } else {
          // Auto-provisioning
          channelId = await this.handleAutoProvisioning(notification.username, message.client);
          // If auto-provisioning returned fallback, roleId remains null.
      }

      const sourceServerName = !isFromCoreServer ? (message.guild?.name || 'Unknown Server') : undefined;

      await this.queueService.enqueue({
        url: notification.url,
        username: notification.username,
        channelId,
        roleId,
        notificationData: notification,
        sourceServer: sourceServerName,
        isCrossServer: !isFromCoreServer
      });

      await this.notificationService.addReaction(
        message,
        isFromCoreServer ? REACTION_EMOJIS.CORE_SERVER : REACTION_EMOJIS.EXTERNAL_SERVER
      );

      logger.info('Notification queued for processing', {
        username: notification.username,
        channelId,
      });

    } catch (error) {
      logger.error('Failed to forward notification', {
        username: notification.username,
        error: (error as Error).message,
      });
    }
  }

  private async handleAutoProvisioning(username: string, client: Client): Promise<string> {
      const config = configManager.get();
      // Sanitize: lowercase and strip ALL characters that are not letters (a-z).
      const sanitized = username.toLowerCase().replace(/[^a-z]/g, '');

      if (!sanitized || sanitized.length < 2) {
          return config.bot.fallbackChannelId;
      }

      try {
        const coreServer = await client.guilds.fetch(config.discord.coreServerId);
        if (!coreServer) {
            logger.warn('Core server not found for auto-provisioning');
            return config.bot.fallbackChannelId;
        }

        const channel = await coreServer.channels.create({
            name: sanitized,
            type: ChannelType.GuildText,
            parent: config.bot.autoCreateCategoryId // "specifically under the parent category"
        });

        await this.userMappingRepo.upsert(username, channel.id);
        logger.info('Auto-provisioned channel', { username, channelId: channel.id });
        return channel.id;
      } catch (error) {
          logger.error('Failed to auto-provision channel', { username, error: (error as Error).message });
          return config.bot.fallbackChannelId;
      }
  }
}
