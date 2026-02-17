import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder } from 'discord.js';
import { configManager } from '../../../core/config/config';

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
			.setColor('#3498db')
			.setTitle('👋 Welcome to TikTok Auto-Provisioner')
			.setDescription('I am an advanced bot designed to automate your TikTok content workflow.')
			.setThumbnail(interaction.client.user?.displayAvatarURL() ?? '')
			.addFields(
				{ name: '✨ Features', value: '• **Auto-Download:** Detects and downloads TikTok links.\n• **Auto-Provisioning:** Creates channels for new users automatically.\n• **Reliability:** Built with a robust queue system.' },
				{ name: '🚀 Getting Started', value: 'Use `/menu` to access the main dashboard or `/download` to manually download a video.' }
			)
			.setFooter({ text: 'Powered by Sapphire Framework' })
            .setTimestamp();

		return interaction.reply({ embeds: [embed] });
	}
}
