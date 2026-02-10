import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { configManager } from '../../core/config/config';

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
			.setColor('#2ecc71')
			.setTitle('🤖 Main Menu')
			.setDescription('Select an option below to manage the bot.')
			.addFields(
				{ name: '🛡️ Admin', value: 'Manage configuration and roles', inline: true },
				{ name: '🔀 Mappings', value: 'Manage user channel mappings', inline: true },
				{ name: '⬇️ Download', value: 'Download TikTok videos', inline: true }
			)
            .setFooter({ text: 'TikTok Forwarder • v2.2.0' })
            .setTimestamp();

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('menu_admin')
					.setLabel('Admin Panel')
					.setStyle(ButtonStyle.Danger)
                    .setEmoji('🛡️'),
				new ButtonBuilder()
					.setCustomId('menu_mappings')
					.setLabel('Mappings')
					.setStyle(ButtonStyle.Primary)
                    .setEmoji('🔀'),
				new ButtonBuilder()
					.setCustomId('menu_tiktok')
					.setLabel('Download')
					.setStyle(ButtonStyle.Success)
                    .setEmoji('⬇️')
			);

		return interaction.reply({ embeds: [embed], components: [row] });
	}
}
