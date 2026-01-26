import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Message, TextChannel } from 'discord.js';
import { container } from '@sapphire/framework';
import { configManager } from '../../../infrastructure/config/config';

@ApplyOptions<Command.Options>({
	description: 'Reprocess a specific message (admin only)',
	preconditions: ['AdminOnly']
})
export class ReforgotCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) =>
					option.setName('message_id').setDescription('ID of the message to reprocess').setRequired(true)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const messageId = interaction.options.getString('message_id', true);
		await interaction.deferReply({ ephemeral: true });

		const channel = interaction.channel;
		if (!channel || !channel.isTextBased()) {
			return interaction.editReply('This command can only be used in text channels.');
		}

		try {
			const message = await (channel as TextChannel).messages.fetch(messageId);
			if (!message) {
				return interaction.editReply('Message not found.');
			}

			// Manually trigger the forwarder logic
			await container.services.forwarder.processMessage(message);

			return interaction.editReply(`Reprocessing initiated for message ${messageId}.`);
		} catch (error) {
			return interaction.editReply(`Error fetching or processing message: ${(error as Error).message}`);
		}
	}
}
