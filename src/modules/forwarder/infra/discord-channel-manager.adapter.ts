
import { ChannelType } from 'discord.js';
import { DiscordChannelManagerPort } from '../ports/discord-channel-manager.port';
import { DiscordClientWrapper } from '../../../interfaces/discord/client';
import { configManager } from '../../../infra/config/config';
import { logger } from '../../../infra/logger';

export class DiscordChannelManagerAdapter implements DiscordChannelManagerPort {
  constructor(private readonly clientWrapper: DiscordClientWrapper) {}

  async createChannel(name: string): Promise<string> {
    const config = configManager.get();
    const guildId = config.discord.coreServerId;
    const categoryId = config.discord.autoCreateCategoryId;

    if (!guildId || !categoryId) {
      throw new Error('CORE_SERVER_ID or AUTO_CREATE_CATEGORY_ID not configured.');
    }

    // Try to get guild from cache first
    let guild = this.clientWrapper.client.guilds.cache.get(guildId);
    
    // If not in cache, try fetching
    if (!guild) {
        try {
            guild = await this.clientWrapper.client.guilds.fetch(guildId);
        } catch (e) {
            throw new Error(`Bot is not in the core server: ${guildId}`);
        }
    }
    
    if (!guild) throw new Error('Guild not found.');

    try {
      logger.info(`Creating new channel: #${name} in category ${categoryId}`);
      
      const channel = await guild.channels.create({
        name: name,
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: `Auto-generated feed for TikTok user: ${name}`,
        reason: 'Auto-provisioning TikTok mapping'
      });

      return channel.id;
    } catch (error) {
      logger.error('Failed to create Discord channel', { error: (error as Error).message });
      throw error;
    }
  }
}
