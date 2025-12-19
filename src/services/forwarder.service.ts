// src/services/forwarder.service.ts
import { Message, Client } from 'discord.js';
import { NotificationService } from './notification.service';
import { configManager } from '../core/config/config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { REACTION_EMOJIS } from '../constants';
import { NotificationData } from '../core/types';

export class ForwarderService {
  constructor(private notificationService: NotificationService) {}

  /**
   * Process incoming Discord message
   */
  async processMessage(message: Message): Promise<void> {
    const config = configManager.get();

    // Ignore if not from source bot
    if (!config.bot.sourceBotIds.includes(message.author.id)) {
      return;
    }

    // Extract notification
    const notification = this.notificationService.extractNotification(message);
    if (!notification) {
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
      if (isFromCoreServer) {
        await this.forwardInCoreServer(notification, message);
      } else {
        await this.forwardToCoreServer(notification, message);
      }
    } catch (error) {
      logger.error('Failed to forward notification', {
        username: notification.username,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Forward notification within core server
   */
  private async forwardInCoreServer(
    notification: NotificationData,
    message: Message
  ): Promise<void> {
    const forwardConfig = await this.notificationService.getForwardConfig(
      notification.username,
      false
    );

    const embed = this.notificationService.createEmbed(
      notification,
      forwardConfig
    );

    await this.notificationService.sendToChannel(
      message.client,
      forwardConfig.channelId,
      embed,
      notification.url
    );

    await this.notificationService.addReaction(
      message,
      REACTION_EMOJIS.CORE_SERVER
    );

    logger.info('Notification forwarded in core server', {
      username: notification.username,
      channelId: forwardConfig.channelId,
    });
  }

  /**
   * Forward notification to core server from external server
   */
  private async forwardToCoreServer(
    notification: NotificationData,
    message: Message
  ): Promise<void> {
    const config = configManager.get();
    const coreServer = await this.fetchCoreServer(message.client);

    if (!coreServer) {
      logger.error('Core server not accessible', {
        coreServerId: config.discord.coreServerId,
      });
      return;
    }

    const sourceServerName = message.guild?.name || 'Unknown Server';
    const forwardConfig = await this.notificationService.getForwardConfig(
      notification.username,
      true,
      sourceServerName
    );

    const embed = this.notificationService.createEmbed(
      notification,
      forwardConfig
    );

    await this.notificationService.sendToChannel(
      message.client,
      forwardConfig.channelId,
      embed,
      notification.url
    );

    await this.notificationService.addReaction(
      message,
      REACTION_EMOJIS.EXTERNAL_SERVER
    );

    logger.info('Notification forwarded to core server', {
      username: notification.username,
      sourceServer: sourceServerName,
      channelId: forwardConfig.channelId,
    });
  }

  private async fetchCoreServer(client: Client) {
    const config = configManager.get();
    try {
      return await withRetry(() =>
        client.guilds.fetch(config.discord.coreServerId)
      );
    } catch (error) {
      return null;
    }
  }
}