import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { configManager } from '../../../infrastructure/config/config';

@ApplyOptions<Subcommand.Options>({
	description: 'Admin configuration commands',
	subcommands: [
		{ name: 'config', chatInputRun: 'configRun' },
		{ name: 'role', chatInputRun: 'roleRun' }
	],
	preconditions: ['AdminOnly', 'CoreServerOnly']
})
export class AdminCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
				.addSubcommand((command) =>
					command
						.setName('config')
						.setDescription('View system configuration')
				)
				.addSubcommand((command) =>
					command
						.setName('role')
						.setDescription('Manage staff roles')
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public async configRun(interaction: Subcommand.ChatInputCommandInteraction) {
		const config = configManager.get();
		const embed = new EmbedBuilder()
			.setTitle('System Configuration')
			.setColor('#ff0000')
			.addFields(
				{ name: 'Environment', value: config.app.nodeEnv, inline: true },
				{ name: 'Log Level', value: config.app.logLevel, inline: true },
				{ name: 'DB Driver', value: config.database.driver, inline: true },
				{ name: 'Auto-Create Category', value: config.bot.autoCreateCategoryId || 'Not Set', inline: true },
				{ name: 'Fallback Channel', value: config.bot.fallbackChannelId || 'Not Set', inline: true }
			);

		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	public async roleRun(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply({ content: 'Role management is implemented via the web dashboard or database directly for now.', ephemeral: true });
	}
}
