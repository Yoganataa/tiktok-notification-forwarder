// src/services/forwarder.service.ts
import { Message, Client, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { NotificationService } from './notification.service';
import { TiktokDownloadService } from './tiktok-download.service'; // Removed unused LiveStreamInfo import
import { configManager } from '../core/config/config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { REACTION_EMOJIS } from '../constants';
import { NotificationData } from '../core/types';

/**
 * Service responsible for orchestrating the notification forwarding flow.
 * * Intercepts incoming Discord messages, filters them, and routes valid
 * TikTok notifications to the appropriate destination channels.
 */
export class ForwarderService {
  constructor(
    private notificationService: NotificationService,
    private tiktokDownloadService: TiktokDownloadService 
  ) {}

  /**
   * Main entry point for processing incoming Discord messages.
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
   */
  private async forwardInCoreServer(
    notification: NotificationData,
    message: Message
  ): Promise<void> {
    const config = configManager.get();
    
    const forwardConfig = await this.notificationService.getForwardConfig(
      notification.username,
      false
    );

    const embed = this.notificationService.createEmbed(
      notification,
      forwardConfig
    );

    // If it's a LIVE notification, try to enrich the embed with real-time data
    if (notification.type === 'live') {
      await this.enrichLiveEmbed(embed, notification.username);
    }

    // If Downloader is ENABLED, do NOT send the raw URL text (pass undefined).
    const urlContent = config.bot.enableDownloader ? undefined : notification.url;

    // 1. Send the Main Embed
    await this.notificationService.sendToChannel(
      message.client,
      forwardConfig.channelId,
      embed,
      urlContent
    );

    // 2. Add Reaction to Source
    await this.notificationService.addReaction(
      message,
      REACTION_EMOJIS.CORE_SERVER
    );

    // 3. Handle Media Download (If TT_DL is true AND not live)
    // We skip download for Live because we can't download a stream to a file easily
    if (notification.type !== 'live') {
      await this.handleMediaDownload(message.client, forwardConfig.channelId, notification.url);
    }

    logger.info('Notification forwarded in core server', {
      username: notification.username,
      channelId: forwardConfig.channelId,
      type: notification.type,
      downloadEnabled: config.bot.enableDownloader
    });
  }

  /**
   * Handles forwarding logic for notifications originating from external/subscriber servers.
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

    // If it's a LIVE notification, try to enrich the embed with real-time data
    if (notification.type === 'live') {
      await this.enrichLiveEmbed(embed, notification.username);
    }

    // If Downloader is ENABLED, do NOT send the raw URL text.
    const urlContent = config.bot.enableDownloader ? undefined : notification.url;

    // 1. Send the Main Embed
    await this.notificationService.sendToChannel(
      message.client,
      forwardConfig.channelId,
      embed,
      urlContent
    );

    // 2. Add Reaction to Source
    await this.notificationService.addReaction(
      message,
      REACTION_EMOJIS.EXTERNAL_SERVER
    );

    // 3. Handle Media Download (If TT_DL is true AND not live)
    if (notification.type !== 'live') {
      await this.handleMediaDownload(message.client, forwardConfig.channelId, notification.url);
    }

    logger.info('Notification forwarded to core server', {
      username: notification.username,
      sourceServer: sourceServerName,
      channelId: forwardConfig.channelId,
      type: notification.type,
      downloadEnabled: config.bot.enableDownloader
    });
  }

  /**
   * Helper to enrich Live Embeds with data from TikTok Search API.
   */
  private async enrichLiveEmbed(embed: EmbedBuilder, username: string): Promise<void> {
    const liveInfo = await this.tiktokDownloadService.getLiveInfo(username);
    
    if (liveInfo) {
      embed.setDescription(`**${liveInfo.title}**`);
      embed.addFields(
        { name: '👥 Viewers', value: liveInfo.viewerCount.toString(), inline: true },
        { name: '🔥 Total Users', value: liveInfo.totalUser.toString(), inline: true }
      );
      if (liveInfo.cover) {
        embed.setImage(liveInfo.cover);
      }
    }
  }

  /**
   * Checks config and downloads/sends media if enabled.
   */
  private async handleMediaDownload(
    client: Client, 
    channelId: string, 
    url?: string
    // Removed unused 'type' parameter
  ): Promise<void> {
    const config = configManager.get();

    // Check if TT_DL feature is enabled
    if (!config.bot.enableDownloader || !url) {
      return;
    }

    try {
      // Fetch the channel object again to send media
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return;

      const media = await this.tiktokDownloadService.download(url);
      
      if (media && media.urls.length > 0) {
        let files: AttachmentBuilder[] = [];

        if (media.type === 'video') {
          // For VIDEO: Only take the first URL.
          const videoUrl = media.urls[0];
          files.push(new AttachmentBuilder(videoUrl, { name: `tiktok_video.mp4` }));
        } else {
          // For IMAGES: We want all slides. Limit to 10.
          files = media.urls.slice(0, 10).map((fileUrl, index) => 
            new AttachmentBuilder(fileUrl, { name: `image_${index + 1}.jpg` })
          );
        }

        // Send media in a separate message
        await (channel as any).send({
          content: `📥 **Downloaded Media** (${media.type})`,
          files: files 
        });

        logger.info('Media downloaded and sent successfully', { url, type: media.type });
      }
    } catch (error) {
      logger.error('Failed to download/send media', {
        url,
        error: (error as Error).message
      });
    }
  }

  /**
   * Helper method to fetch the Core Guild object with retry logic.
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