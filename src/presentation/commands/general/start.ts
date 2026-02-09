import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder } from 'discord.js';
import { configManager } from '../../../infrastructure/config/config';

@ApplyOptions<Command.Options>({
	description: 'Welcome command and bot introduction',
	preconditions: ['CoreServerOnly']
})
export class StartCommand extends Command {
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
			.setColor('#0099ff')
			.setTitle('Welcome to TikTok Auto-Provisioner')
			.setDescription('I am a bot that downloads TikToks and manages channels automatically.')
			.addFields(
				{ name: 'Features', value: '• Auto-download TikToks\n• Auto-create channels for new users\n• Queue system for reliability' },
				{ name: 'Commands', value: 'Use `/menu` to see all available commands.' }
			)
			.setFooter({ text: 'Powered by Sapphire Framework' });

		return interaction.reply({ embeds: [embed] });
	}
}
