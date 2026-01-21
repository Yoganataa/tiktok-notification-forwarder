import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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

    // Use dynamic import or simple instantiation if possible, mainly we need config repo
    const { SystemConfigRepository } = require('../../core/repositories/system-config.repository');
    const service = new DownloaderService(new SystemConfigRepository());

    try {
        if (subcommand === 'dl') {
            const url = interaction.options.getString('url', true);

            const result = await service.download(url);

            const files: any[] = [];
            if (result.type === 'video' && result.buffer) {
                files.push({ attachment: result.buffer, name: 'video.mp4' });
            } else if (result.type === 'image') {
                if (result.buffers && result.buffers.length > 0) {
                    result.buffers.forEach((buf, i) => files.push({ attachment: buf, name: `image_${i+1}.jpg` }));
                } else if (result.buffer) {
                    files.push({ attachment: result.buffer, name: 'image.jpg' });
                }
            }

            const totalSize = files.reduce((acc, f) => acc + f.attachment.length, 0);
            const MAX_SIZE = 24 * 1024 * 1024; // ~24MB

            if (totalSize > MAX_SIZE) {
                await interaction.editReply(`Files too large (>25MB). [Link](${url})`);
            } else if (files.length === 0) {
                 await interaction.editReply(`No media found. [Link](${url})`);
            } else {
                await interaction.editReply({ content: `Download successful!`, files });
            }
        } else if (subcommand === 'stalk') {
            const username = interaction.options.getString('username', true);
            // StalkUser does not strictly require cookie for basic info in v1/v2 but v3 might.
            // Using TobyLib directly
            const result = await TobyLib.StalkUser(username);

            if (result.status === 'success' && result.result) {
                const user = result.result.user;
                const stats = result.result.stats;

                const embed = new EmbedBuilder()
                    .setTitle(`@${user.username}`)
                    .setURL(`https://www.tiktok.com/@${user.username}`)
                    .setDescription(user.signature || 'No bio')
                    .setThumbnail(user.avatarThumb)
                    .addFields(
                        { name: 'Nickname', value: user.nickname || 'Unknown', inline: true },
                        { name: 'Followers', value: (stats.followerCount || 0).toString(), inline: true },
                        { name: 'Following', value: (stats.followingCount || 0).toString(), inline: true },
                        { name: 'Likes', value: (stats.heartCount || 0).toString(), inline: true },
                        { name: 'Videos', value: (stats.videoCount || 0).toString(), inline: true }
                    )
                    .setColor(0x00f2ea)
                    .setFooter({ text: 'TikTok Stalk' });

                await interaction.editReply({ content: null, embeds: [embed] });
            } else {
                await interaction.editReply('User not found or error fetching data.');
            }
        } else if (subcommand === 'search') {
             if (!process.env.COOKIE) {
                await interaction.editReply('❌ Cookie not configured in .env. Search disabled.');
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
