import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DownloaderService } from '../downloader/downloader.service';
import TobyLib from '../downloader/engines/toby-lib/index';
import { logger } from '../../shared/utils/logger';

export const tiktokCommand = new SlashCommandBuilder()
  .setName('tiktok')
  .setDescription('TikTok utilities')
  .addSubcommand(sub =>
    sub.setName('dl').setDescription('Download video from URL')
       .addStringOption(opt => opt.setName('url').setDescription('TikTok URL').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('stalk').setDescription('Get user profile')
       .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('search').setDescription('Search TikTok')
       .addStringOption(opt => opt.setName('query').setDescription('Search query').setRequired(true))
  );

export async function handleTikTokCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    const { SystemConfigRepository } = require('../../core/repositories/system-config.repository');
    const service = new DownloaderService(new SystemConfigRepository());

    try {
        if (subcommand === 'dl') {
            const url = interaction.options.getString('url', true);

            const result = await service.download(url);

            const files = [];
            if (result.type === 'video' && result.buffer) files.push({ attachment: result.buffer, name: 'video.mp4' });
            else if (result.type === 'image' && result.buffer) files.push({ attachment: result.buffer, name: 'image.jpg' });

            const MAX_SIZE = 25 * 1024 * 1024;
            if (result.buffer && result.buffer.length > MAX_SIZE) {
                await interaction.editReply(`File too large (>25MB). [Link](${url})`);
            } else {
                await interaction.editReply({ content: `Download successful!`, files });
            }
        } else if (subcommand === 'stalk') {
            if (!process.env.COOKIE) {
                await interaction.editReply('❌ Cookie not configured. Stalk feature disabled.');
                return;
            }
            const username = interaction.options.getString('username', true);
            const result = await TobyLib.StalkUser(username);
            if (result.status === 'success' && result.result) {
                const user = result.result.user;
                const stats = result.result.stats;
                const content = `**${user.nickname}** (@${user.username})\n` +
                                `Followers: ${stats.followerCount} | Following: ${stats.followingCount} | Likes: ${stats.heartCount}\n` +
                                `${user.signature}\n${user.avatarThumb}`;
                await interaction.editReply(content);
            } else {
                await interaction.editReply('User not found or error fetching data.');
            }
        } else if (subcommand === 'search') {
            if (!process.env.COOKIE) {
                await interaction.editReply('❌ Cookie not configured. Search feature disabled.');
                return;
            }
            const query = interaction.options.getString('query', true);
            const result = await TobyLib.Search(query, { type: 'user', page: 1, cookie: process.env.COOKIE });
            if (result.status === 'success' && result.result && Array.isArray(result.result) && result.result.length > 0) {
                const users = result.result.slice(0, 5).map((u: any) => `• **${u.nickname}** (@${u.username}) - ${u.followerCount} followers`).join('\n');
                await interaction.editReply(`Search results for "${query}":\n${users}`);
            } else {
                await interaction.editReply('No results found.');
            }
        }
    } catch (error) {
        logger.error('TikTok command error', { error: (error as Error).message });
        await interaction.editReply(`Error: ${(error as Error).message}`);
    }
}
