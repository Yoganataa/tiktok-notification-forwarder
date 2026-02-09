import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { configManager } from '../../../infrastructure/config/config';

@ApplyOptions<Command.Options>({
	description: 'Display the main menu',
	preconditions: ['CoreServerOnly']
})
export class MenuCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const embed = new EmbedBuilder()
			.setColor('#00ff00')
			.setTitle('Main Menu')
			.setDescription('Select an option below to manage the bot.')
			.addFields(
				{ name: 'Admin', value: 'Manage configuration and roles (Admin only)', inline: true },
				{ name: 'Mappings', value: 'Manage user channel mappings', inline: true },
				{ name: 'TikTok', value: 'Download or search TikToks', inline: true }
			);

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('menu_admin')
					.setLabel('Admin Panel')
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setCustomId('menu_mappings')
					.setLabel('Mappings')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('menu_tiktok')
					.setLabel('TikTok Tools')
					.setStyle(ButtonStyle.Success)
			);

		return interaction.reply({ embeds: [embed], components: [row] });
	}
}
