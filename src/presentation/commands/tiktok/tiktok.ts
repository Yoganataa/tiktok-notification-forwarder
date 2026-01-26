import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder } from 'discord.js';
import { container } from '@sapphire/framework';
import { configManager } from '../../../infrastructure/config/config';

@ApplyOptions<Subcommand.Options>({
	description: 'TikTok utility commands',
	subcommands: [
		{ name: 'dl', chatInputRun: 'dlRun' },
		{ name: 'stalk', chatInputRun: 'stalkRun' },
		{ name: 'search', chatInputRun: 'searchRun' }
	],
	preconditions: ['CoreServerOnly']
})
export class TiktokCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((command) =>
					command
						.setName('dl')
						.setDescription('Download a TikTok video')
						.addStringOption((option) =>
							option.setName('url').setDescription('TikTok URL').setRequired(true)
						)
				)
				.addSubcommand((command) =>
					command
						.setName('stalk')
						.setDescription('Get user stats')
						.addStringOption((option) =>
							option.setName('username').setDescription('TikTok Username').setRequired(true)
						)
				)
				.addSubcommand((command) =>
					command
						.setName('search')
						.setDescription('Search TikTok')
						.addStringOption((option) =>
							option.setName('query').setDescription('Search Query').setRequired(true)
						)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public async dlRun(interaction: Subcommand.ChatInputCommandInteraction) {
		const url = interaction.options.getString('url', true);
		await interaction.deferReply();

		try {
			const downloader = container.services.downloader;
			const result = await downloader.download(url);

			if (result) {
				const { buffer, type, urls } = result;
				if (buffer && buffer.length < 25 * 1024 * 1024) { // 25MB check
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

	public async stalkRun(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply({ content: 'Stalk feature not implemented yet.', ephemeral: true });
	}

	public async searchRun(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply({ content: 'Search feature not implemented yet.', ephemeral: true });
	}
}
