import { Message, Client, ChannelType } from 'discord.js';
import { DiscordNotificationService } from './notification.service';
import { QueueService } from '../../core/services/queue.service';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { configManager } from '../../core/config/config';
import { logger } from '../../core/utils/logger';
import { REACTION_EMOJIS } from '../../core/constants';

export class ForwarderService {
  constructor(
    private notificationService: DiscordNotificationService,
    private queueService: QueueService,
    private userMappingRepo: UserMappingRepository
  ) {}

  async processMessage(message: Message): Promise<void> {
    const config = configManager.get();
    const sourceBotIds = config.bot.sourceBotIds;
    const ownerId = config.discord.ownerId;

    const isMatch = sourceBotIds.includes(message.author.id) || message.author.id === ownerId;

    if (!isMatch) {
        return;
    }

    logger.info('Message Detected', {
        id: message.id,
        author: message.author.tag,
        authorId: message.author.id,
        content: message.content,
        isMatch
    });

    const notification = this.notificationService.extractNotification(message);
    if (!notification || !notification.url) {
      return;
    }

    const isFromCoreServer = message.guildId === config.discord.coreServerId;

    try {
      let channelId: string;
      let roleId: string | null = null;

      const mapping = await this.userMappingRepo.findByUsername(notification.username);

      if (mapping) {
          channelId = mapping.channel_id;
          roleId = mapping.role_id || null;
      } else {
          channelId = await this.handleAutoProvisioning(notification.username, message.client);
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
            parent: config.bot.autoCreateCategoryId
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
