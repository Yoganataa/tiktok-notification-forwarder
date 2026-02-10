import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { container } from '@sapphire/framework';
import { configManager } from '../../core/config/config';

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
				const { buffer, type, urls } = result;
				// Check for buffer existence and size (25MB limit for standard Discord bots)
				if (buffer && buffer.length < 25 * 1024 * 1024) {
					await interaction.editReply({
						content: `Downloaded!`,
						files: [{ attachment: buffer, name: `tiktok.${type === 'video' ? 'mp4' : 'png'}` }]
					});
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
