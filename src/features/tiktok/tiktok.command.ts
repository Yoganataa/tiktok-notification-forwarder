import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BaseCommand } from '../../core/contracts/module.contract';
import { DownloaderService } from '../downloader/downloader.service';
import { logger } from '../../shared/utils/logger';
import { sendChunkedReply } from '../../shared/utils/discord-chunker';

export default class TikTokCommand extends BaseCommand {
    get definition() {
        return new SlashCommandBuilder()
            .setName('tiktok')
            .setDescription('TikTok utilities')
            .addSubcommand(sub =>
                sub.setName('dl').setDescription('Download video from URL')
                .addStringOption(opt => opt.setName('url').setDescription('TikTok URL').setRequired(true))
            );
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        return handleTikTokCommand(interaction);
    }
}

async function handleTikTokCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    // Use dynamic import or simple instantiation if possible, mainly we need config repo
    const { SystemConfigRepository } = require('../../core/repositories/system-config.repository');
    // NOTE: In the new architecture, Services should be Injected.
    // However, keeping this compatible with existing logic for now.
    // Ideally, the CommandRegistry should inject dependencies into Commands.
    const service = new DownloaderService(new SystemConfigRepository());
    // Service must be initialized to load engines
    await service.init();

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

            const MAX_SIZE = 24 * 1024 * 1024; // ~24MB
            const anyFileTooLarge = files.some(f => f.attachment.length > MAX_SIZE);

            if (anyFileTooLarge) {
                await interaction.editReply(`One or more files too large (>25MB). [Link](${url})`);
            } else if (files.length === 0) {
                 await interaction.editReply(`No media found or download failed. [Link](${url})`);
            } else {
                await sendChunkedReply(interaction, `Download successful!`, [], files);
            }
        }
    } catch (error) {
        logger.error('TikTok command error', { error: (error as Error).message });
        await interaction.editReply(`Error: ${(error as Error).message}`);
    }
}
