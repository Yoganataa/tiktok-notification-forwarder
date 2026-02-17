import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { container } from '@sapphire/framework';
import { configManager } from '../../../core/config/config';

@ApplyOptions<Command.Options>({
	description: 'Remove staff access from a user',
	preconditions: ['CoreServerOnly', 'AdminOnly']
})
export class DemoteCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addUserOption((option) =>
					option.setName('user').setDescription('Discord User').setRequired(true)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true);
		await interaction.deferReply({ ephemeral: true });

		try {
			await container.services.permission.revokeAccess(user.id);
			await interaction.editReply(`✅ Revoked access for **${user.username}**.`);
		} catch (error) {
			await interaction.editReply(`❌ Error: ${(error as Error).message}`);
		}
	}
}
