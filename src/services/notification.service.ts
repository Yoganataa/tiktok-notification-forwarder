import { Message, Client, TextChannel, EmbedBuilder } from 'discord.js';
import { UserMappingRepository } from '../repositories/user-mapping.repository';
import { configManager } from '../core/config/config';
import { logger } from '../shared/utils/logger';
import { withRetry } from '../shared/utils/retry';
import { LIVE_PATTERNS, TIKTOK_URL_PATTERN, EMBED_COLORS } from '../constants';
import {
  ContentType,
  TikTokUsername,
  NotificationData,
  ForwardConfig,
} from '../types';

export class NotificationService {
  constructor(private userMappingRepo: UserMappingRepository) {}

  extractNotification(message: Message): NotificationData | null {
    let username: string | null = null;
    let url: string | undefined;
    let type: ContentType = 'unknown';

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
      username = this.extractFromText(message.content);
    }

    if (!username) {
      return null;
    }

    type = this.determineContentType(url, message.content);

    return {
      username: username.toLowerCase().trim(),
      url,
      type,
    };
  }

  async getForwardConfig(
    username: TikTokUsername,
    isCrossServer: boolean,
    sourceServerName?: string
  ): Promise<ForwardConfig> {
    const config = configManager.get();
    const mapping = await this.userMappingRepo.findByUsername(username);

    return {
      channelId: mapping?.channel_id || config.bot.fallbackChannelId,
      isCrossServer,
      sourceServerName,
      roleId: mapping?.role_id
    };
  }

  createEmbed(
    notification: NotificationData,
    forwardConfig: ForwardConfig
  ): EmbedBuilder {
    const embed = new EmbedBuilder().setTimestamp();

    const { statusText, actionText, color } = this.getEmbedStyle(
      notification.type
    );

    embed.setColor(color);

    if (forwardConfig.isCrossServer && forwardConfig.sourceServerName) {
      embed
        .setTitle(`📬 TikTok ${this.capitalize(notification.type)} Notification`)
        .setFooter({ text: `From ${forwardConfig.sourceServerName}` });
    } else {
      embed
        .setTitle('📬 TikTok Notification')
        .setFooter({ text: 'TikTok Alert System' });
    }

    embed.addFields(
      { name: 'Creator', value: `@${notification.username}`, inline: true },
      { name: 'Status', value: statusText, inline: true }
    );

    if (forwardConfig.isCrossServer && forwardConfig.sourceServerName) {
      embed.addFields({
        name: 'Source',
        value: forwardConfig.sourceServerName,
        inline: false,
      });
    }

    if (notification.url) {
      embed.addFields({
        name: 'Link',
        value: `[${actionText}](${notification.url})`,
        inline: false,
      });
    }

    return embed;
  }

  async sendToChannel(
    client: Client,
    channelId: string,
    embed: EmbedBuilder,
    url?: string
  ): Promise<void> {
    const channel = await this.fetchChannel(client, channelId);

    if (!channel) {
      throw new Error(`Channel ${channelId} is not accessible or not text-based`);
    }

    const payload: any = { embeds: [embed] };
    if (url) {
      payload.content = url;
    }

    await withRetry(() => channel.send(payload));
  }

  async addReaction(message: Message, emoji: string): Promise<void> {
    try {
      await withRetry(() => message.react(emoji));
    } catch (error) {
      logger.warn('Failed to add reaction', {
        messageId: message.id,
        emoji,
        error: (error as Error).message,
      });
    }
  }

  private extractFromText(text: string): string | null {
    for (const pattern of LIVE_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  }

  private extractFromEmbeds(message: Message): {
    username: string | null;
    url?: string;
  } {
    let username: string | null = null;
    let url: string | undefined;

    for (const embed of message.embeds) {
      const embedText = [
        embed.title,
        embed.description,
        embed.author?.name,
      ]
        .filter(Boolean)
        .join(' ');

      const textUsername = this.extractFromText(embedText);
      if (textUsername) {
        username = textUsername;
      }

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

  private extractFromComponents(message: Message): {
    username: string | null;
    url?: string;
  } {
    for (const row of message.components) {
      if ('components' in row) {
        for (const component of row.components) {
          if ('url' in component && component.url) {
            if (TIKTOK_URL_PATTERN.test(component.url)) {
              const urlMatch = component.url.match(TIKTOK_URL_PATTERN);
              if (urlMatch?.[1]) {
                return {
                  username: urlMatch[1],
                  url: component.url,
                };
              }
            }
          }
        }
      }
    }

    return { username: null };
  }

  private determineContentType(
    url: string | undefined,
    content: string
  ): ContentType {
    if (url) {
      if (url.includes('/video/')) return 'video';
      if (url.includes('/photo/')) return 'photo';
      if (url.includes('/live')) return 'live';
    }

    const isLiveText = LIVE_PATTERNS.some((pattern) => pattern.test(content));
    if (isLiveText) return 'live';

    return 'unknown';
  }

  private getEmbedStyle(type: ContentType): {
    statusText: string;
    actionText: string;
    color: number;
  } {
    switch (type) {
      case 'live':
        return {
          statusText: '🔴 Live Now',
          actionText: 'Watch Stream',
          color: EMBED_COLORS.TIKTOK,
        };
      case 'video':
        return {
          statusText: '🎬 New Video',
          actionText: 'Watch Video',
          color: 0x00f2ea,
        };
      case 'photo':
        return {
          statusText: '📸 New Photo',
          actionText: 'View Photos',
          color: 0xffd700,
        };
      default:
        return {
          statusText: '❓ Unknown',
          actionText: 'View Content',
          color: 0x808080,
        };
    }
  }

  private async fetchChannel(
    client: Client,
    channelId: string
  ): Promise<TextChannel | null> {
    try {
      const channel = await withRetry(() => client.channels.fetch(channelId));

      if (channel && channel.isTextBased()) {
        return channel as TextChannel;
      }

      if (channel) {
        logger.warn('Channel fetched but is not text-based', {
          channelId,
          type: channel.type,
        });
      }

      return null;
    } catch (error) {
      logger.error('Failed to fetch channel', {
        channelId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
