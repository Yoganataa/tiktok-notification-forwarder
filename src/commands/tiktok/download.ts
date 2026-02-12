import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { container } from '@sapphire/framework';
import { configManager } from '../../core/config/config';
import { sendChunkedReply } from '../../shared/utils/discord-chunker';
import { AttachmentBuilder } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'Download a TikTok video',
	preconditions: ['CoreServerOnly']
})
export class DownloadCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('download')
				.setDescription(this.description)
				.addStringOption((option) =>
					option.setName('url').setDescription('TikTok URL').setRequired(true)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const url = interaction.options.getString('url', true);
		await interaction.deferReply();

		try {
			const downloader = container.services.downloader;
			const result = await downloader.download(url);

			if (result) {
				const { buffer, buffers, type, urls } = result;
				const attachments: AttachmentBuilder[] = [];
				let tooLarge = false;

				// 1. Handle Slideshow (Multiple Buffers)
				if (type === 'image' && buffers && buffers.length > 0) {
					for (let i = 0; i < buffers.length; i++) {
						const buf = buffers[i];
						if (buf.length > 25 * 1024 * 1024) {
							tooLarge = true;
							break;
						}
						attachments.push(new AttachmentBuilder(buf, { name: `image_${i + 1}.png` }));
					}
				}
				// 2. Handle Single File (Video/Image)
				else if (buffer) {
					if (buffer.length > 25 * 1024 * 1024) {
						tooLarge = true;
					} else {
						const ext = type === 'video' ? 'mp4' : 'png';
						attachments.push(new AttachmentBuilder(buffer, { name: `tiktok.${ext}` }));
					}
				} else {
					tooLarge = true; // No buffer available
				}

				// 3. Send Response
				if (!tooLarge && attachments.length > 0) {
					await sendChunkedReply(interaction, 'Downloaded!', [], attachments);
				} else {
					await interaction.editReply({
						content: `Video too large or no buffer. Here are the links:\n${urls.join('\n')}`
					});
				}

			} else {
				await interaction.editReply('Failed to download video.');
			}
		} catch (error) {
			await interaction.editReply(`Error: ${(error as Error).message}`);
		}
	}
}
