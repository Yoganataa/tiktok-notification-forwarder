// src/services/forwarder.ts
import { Message, EmbedBuilder, TextChannel, Client } from 'discord.js';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { LIVE_PATTERNS, TIKTOK_URL_PATTERN, REACTION_EMOJIS, EMBED_COLORS } from '../constants';
import type { TikTokUsername, ContentType } from '../types';

interface NotificationData {
  /** TikTok username (lowercase, without @) */
  username: TikTokUsername;
  /** Optional TikTok profile or live stream URL */
  url?: string;
  /** Discord message that triggered the notification */
  originalMessage: Message;
  type?: ContentType;
}

/**
 * Configuration for forwarding behavior
 */
interface ForwardConfig {
  /** Target channel ID for forwarding */
  channelId: string;
  /** Whether this is forwarding to core server */
  isCrossServer: boolean;
  /** Name of source server (for cross-server forwards) */
  sourceServerName?: string;
}

/**
 * Service responsible for detecting and forwarding TikTok live notifications
 * Supports both single-server and multi-server (core server) architectures
 */
export class NotificationForwarder {
  /**
   * Processes incoming messages and forwards TikTok live notifications
   * 
   * @param message - Discord message to process
   * @returns Promise that resolves when processing is complete
   * 
   * @remarks
   * - Only processes messages from configured source bot
   * - Automatically routes to core server if message is from external server
   * - Adds appropriate reaction emojis to source message
   */
  async processMessage(message: Message): Promise<void> {
    if (!this.isFromSourceBot(message)) {
      return;
    }

    const notification = this.extractNotification(message);
    
    if (!notification) {
      return;
    }

    const isFromCoreServer = this.isFromCoreServer(message);

    logger.info('Notification detected', {
      username: notification.username,
      messageId: message.id,
      channelId: message.channel.id,
      guildId: message.guildId,
      guildName: message.guild?.name,
      isFromCoreServer
    });

    try {
      if (isFromCoreServer) {
        await this.forwardInCoreServer(notification);
      } else {
        await this.forwardToCoreServer(notification);
      }
    } catch (error) {
      logger.error('Failed to process notification', {
        username: notification.username,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Checks if message is from the configured source bot
   * 
   * @param message - Message to check
   * @returns true if message is from source bot
   */
  private isFromSourceBot(message: Message): boolean {
    return config.sourceBotIds.includes(message.author.id);
  }

  /**
   * Checks if message is from the core server
   * 
   * @param message - Message to check
   * @returns true if message is from core server
   */
  private isFromCoreServer(message: Message): boolean {
    return message.guildId === config.coreServerId;
  }

  /**
   * Extracts notification data from a Discord message
   * 
   * @param message - Message to extract from
   * @returns Notification data if found, null otherwise
   * 
   * @remarks
   * Extraction order:
   * 1. Message content (regex patterns)
   * 2. Embed content (title, description, author, URL)
   * 3. Message components (buttons with URLs)
   */
private extractNotification(message: Message): NotificationData | null {
    let username: string | null = null;
    let url: string | undefined;
    let type: ContentType = 'unknown'; // Default type

    if (message.embeds.length > 0) {
      const embedResult = this.extractFromEmbeds(message);
      if (embedResult.username) username = embedResult.username;
      if (embedResult.url) url = embedResult.url;
    }

    if (!username && message.components.length > 0) {
      const componentResult = this.extractFromComponents(message);
      if (componentResult.username) username = componentResult.username;
      if (componentResult.url) url = componentResult.url;
    }

    if (!username) {
      const contentResult = this.extractFromText(message.content);
      if (contentResult) username = contentResult;
    }

    if (url) {
      if (url.includes('/video/')) {
        type = 'video';
      } else if (url.includes('/photo/')) {
        type = 'photo';
      } else if (url.includes('/live')) {
        type = 'live';
      } else {
        type = 'unknown';
      }
    } else if (username) {
      const isLiveText = LIVE_PATTERNS.some(pattern => pattern.test(message.content));
      if (isLiveText) {
        type = 'live';
      } else {
        type = 'unknown';
      }
    }

    if (!username) {
      return null;
    }

    return {
      username: username.toLowerCase(),
      url,
      originalMessage: message,
      type 
    };
  }

  /**
   * Extracts username from text using live patterns
   * 
   * @param text - Text to search
   * @returns Username if found, null otherwise
   */
  private extractFromText(text: string): string | null {
    for (const pattern of LIVE_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extracts username and URL from message embeds
   * 
   * @param message - Message containing embeds
   * @returns Object with username and/or URL if found
   */
  private extractFromEmbeds(message: Message): { username: string | null; url?: string } {
    let username: string | null = null;
    let url: string | undefined;

    for (const embed of message.embeds) {
      // Check embed text fields
      const embedText = [
        embed.title,
        embed.description,
        embed.author?.name
      ].filter(Boolean).join(' ');

      const textUsername = this.extractFromText(embedText);
      if (textUsername) {
        username = textUsername;
      }

      // Check embed URL
      if (embed.url && TIKTOK_URL_PATTERN.test(embed.url)) {
        const urlMatch = embed.url.match(TIKTOK_URL_PATTERN);
        if (urlMatch?.[1]) {
          username = username || urlMatch[1];
          url = embed.url;
        }
      }

      if (username) break;
    }

    return { username, url };
  }

/**
   * Extracts username and URL from message components (buttons)
   */
  private extractFromComponents(message: Message): { username: string | null; url?: string } {
    let username: string | null = null;
    let url: string | undefined;

    // --- LOG DEBUGGING TAMBAHAN ---
    // Log ini akan muncul di terminal setiap kali ada pesan dengan tombol masuk
    if (message.components.length > 0) {
       logger.info(`DEBUG: Memeriksa ${message.components.length} baris komponen`);
    }
    // -----------------------------

    for (const row of message.components) {
      if ('components' in row) {
        for (const component of row.components) {
          
          if ('url' in component && component.url) {
            logger.info(`DEBUG: Menemukan URL di tombol: ${component.url}`);

            if (TIKTOK_URL_PATTERN.test(component.url)) {
              const urlMatch = component.url.match(TIKTOK_URL_PATTERN);
              if (urlMatch?.[1]) {
                username = urlMatch[1];
                url = component.url;
                
                logger.info(`DEBUG: Regex cocok! Username: ${username}`); // Log sukses
                
                return { username, url };
              }
            } else {
                logger.warn(`DEBUG: URL tombol tidak cocok dengan pola Regex TIKTOK_URL_PATTERN`);
            }
          }
        }
      }
    }

    return { username, url };
  }

  /**
   * Forwards notification within the core server (same server)
   * 
   * @param notification - Notification data to forward
   */
  private async forwardInCoreServer(notification: NotificationData): Promise<void> {
    const forwardConfig = await this.getForwardConfig(notification.username, false);
    
    await this.sendNotification(
      notification,
      forwardConfig,
      notification.originalMessage.client
    );

    await this.addReaction(notification.originalMessage, REACTION_EMOJIS.CORE_SERVER);

    logger.info('Notification forwarded in core server', {
      username: notification.username,
      targetChannelId: forwardConfig.channelId
    });
  }

  /**
   * Forwards notification from external server to core server
   * 
   * @param notification - Notification data to forward
   */
  private async forwardToCoreServer(notification: NotificationData): Promise<void> {
    const coreServer = await this.fetchCoreServer(notification.originalMessage.client);
    
    if (!coreServer) {
      logger.error('Core server not accessible', {
        coreServerId: config.coreServerId,
        username: notification.username
      });
      return;
    }

    const sourceServerName = notification.originalMessage.guild?.name || 'Unknown Server';
    const forwardConfig = await this.getForwardConfig(
      notification.username,
      true,
      sourceServerName
    );

    await this.sendNotification(
      notification,
      forwardConfig,
      notification.originalMessage.client
    );

    await this.addReaction(notification.originalMessage, REACTION_EMOJIS.EXTERNAL_SERVER);

    logger.info('Notification forwarded to core server', {
      username: notification.username,
      sourceGuildId: notification.originalMessage.guildId,
      sourceGuildName: sourceServerName,
      targetChannelId: forwardConfig.channelId
    });
  }

  /**
   * Fetches the core server guild
   * 
   * @param client - Discord client instance
   * @returns Core server guild or null if not found
   */
  private async fetchCoreServer(client: Client) {
    try {
      return await withRetry(() => client.guilds.fetch(config.coreServerId));
    } catch (error) {
      logger.error('Failed to fetch core server', {
        coreServerId: config.coreServerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Gets forward configuration for a username
   * 
   * @param username - TikTok username to lookup
   * @param isCrossServer - Whether forwarding across servers
   * @param sourceServerName - Name of source server (for cross-server)
   * @returns Forward configuration with channel ID and metadata
   */
  private async getForwardConfig(
    username: string,
    isCrossServer: boolean,
    sourceServerName?: string
  ): Promise<ForwardConfig> {
    const mapping = await withRetry(() =>
      prisma.userMapping.findUnique({
        where: { username }
      })
    );

    return {
      channelId: mapping?.channelId || config.fallbackChannelId,
      isCrossServer,
      sourceServerName
    };
  }

/**
   * Sends notification embed to target channel
   * * @param notification - Notification data
   * @param forwardConfig - Forward configuration
   * @param client - Discord client instance
   */
  private async sendNotification(
    notification: NotificationData,
    forwardConfig: ForwardConfig,
    client: Client
  ): Promise<void> {
    const channel = await this.fetchChannel(client, forwardConfig.channelId);

    if (!channel?.isTextBased()) {
      logger.error('Target channel is not accessible or not text-based', {
        channelId: forwardConfig.channelId,
        username: notification.username
      });
      return;
    }

    const embed = this.createNotificationEmbed(notification, forwardConfig);

    const messagePayload: any = {
      embeds: [embed]
    };

    if (notification.url) {
      messagePayload.content = notification.url;
    }

    await withRetry(() => channel.send(messagePayload));
  }

  /**
   * Fetches a Discord channel by ID
   * 
   * @param client - Discord client instance
   * @param channelId - Channel ID to fetch
   * @returns TextChannel or null if not found
   */
  private async fetchChannel(client: Client, channelId: string): Promise<TextChannel | null> {
    try {
      const channel = await withRetry(() => client.channels.fetch(channelId));
      return channel as TextChannel;
    } catch (error) {
      logger.error('Failed to fetch channel', {
        channelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

 /**
   * Creates notification embed based on forward configuration
   * * @param notification - Notification data
   * @param forwardConfig - Forward configuration
   * @returns Formatted Discord embed
   */
  private createNotificationEmbed(
    notification: NotificationData,
    forwardConfig: ForwardConfig
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTimestamp();

    let statusText = '';
    let actionText = '';
    let color: number = EMBED_COLORS.TIKTOK; 

    const contentType = notification.type || 'unknown'; 

    switch (contentType) {
      case 'live':
        statusText = '🔴 Live Now';
        actionText = 'Watch Stream';
        color = EMBED_COLORS.TIKTOK; 
        break;
      case 'video':
        statusText = '🎬 New Video Content';
        actionText = 'Watch Video';
        color = 0x00F2EA; 
        break;
      case 'photo':
        statusText = '📸 New Photo Content';
        actionText = 'View Photos';
        color = 0xFFD700; 
        break;
      default:
        statusText = '❓ Unknown Content'; 
        actionText = 'View Content';
        color = 0x808080; 
        break;
    }

    embed.setColor(color);

    if (forwardConfig.isCrossServer && forwardConfig.sourceServerName) {
      embed
        .setTitle(`📬 TikTok Notification: ${this.capitalize(contentType)}`)
        .setFooter({ text: `Forwarded from ${forwardConfig.sourceServerName}` });
    } else {
      embed
        .setTitle('📬 TikTok Notification Forwarded')
        .setFooter({ text: 'TikTok Alert System' });
    }

    // Setup Fields
    embed.addFields(
      { name: 'Creator', value: `@${notification.username}`, inline: true },
      { name: 'Status', value: statusText, inline: true }
    );

    if (forwardConfig.isCrossServer) {
       embed.addFields({ name: 'Source Server', value: forwardConfig.sourceServerName || 'Unknown', inline: false });
    }

    if (notification.url) {
      embed.addFields({
        name: 'Link',
        value: `[${actionText}](${notification.url})`,
        inline: false
      });
    }

    return embed;
  }

  /**
   * Capitalizes the first letter of a string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Adds reaction emoji to message with error handling
   * 
   * @param message - Message to react to
   * @param emoji - Emoji to add
   */
  private async addReaction(message: Message, emoji: string): Promise<void> {
    try {
      await withRetry(() => message.react(emoji));
    } catch (error) {
      logger.warn('Failed to add reaction', {
        messageId: message.id,
        emoji,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Singleton instance of NotificationForwarder
 */
export const forwarder = new NotificationForwarder();