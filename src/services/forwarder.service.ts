// src/services/forwarder.service.ts
import { Message, Client } from 'discord.js';
import { NotificationService } from './notification.service';
import { configManager } from '../core/config/config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { REACTION_EMOJIS } from '../constants';
import { NotificationData } from '../core/types';

/**
 * Service responsible for orchestrating the notification forwarding flow.
 * * Intercepts incoming Discord messages, filters them, and routes valid
 * TikTok notifications to the appropriate destination channels within the Core Server.
 */
export class ForwarderService {
  constructor(private notificationService: NotificationService) {}

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
   * Handles forwarding logic for notifications originating from within the Core Server.
   * * Uses standard formatting without cross-server attribution.
   * * Reacts with the Core Server emoji on success.
   * * @param notification - The extracted notification data.
   * * @param message - The original source message.
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
   * Handles forwarding logic for notifications originating from external/subscriber servers.
   * * Adds source server attribution to the forwarded message.
   * * Reacts with the External Server emoji on success.
   * * @param notification - The extracted notification data.
   * * @param message - The original source message.
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

  /**
   * Helper method to fetch the Core Guild object with retry logic.
   * * Ensures connectivity to the main server before attempting to forward.
   * * @param client - The Discord client instance.
   * * @returns The Guild object if found, otherwise null.
   */
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