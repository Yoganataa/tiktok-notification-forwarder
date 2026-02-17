import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { container } from '@sapphire/framework';
import { configManager } from '../../../core/config/config';
import { ROLES, UserRole } from '../../../core/types/database.types';

@ApplyOptions<Command.Options>({
	description: 'Promote a user to staff',
	preconditions: ['CoreServerOnly', 'AdminOnly']
})
export class PromoteCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('promote')
				.setDescription(this.description)
				.addUserOption((option) =>
					option.setName('user').setDescription('Discord User').setRequired(true)
				)
				.addStringOption((option) =>
					option.setName('role').setDescription('Role (ADMIN/SUDO)').setRequired(true)
						.addChoices(
							{ name: 'Admin', value: 'ADMIN' },
							{ name: 'Sudo', value: 'SUDO' }
						)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true);
		const roleStr = interaction.options.getString('role', true);

		// Determine the role constant from the string input
        let targetRole: UserRole = ROLES.SUDO;
        if (roleStr === 'ADMIN') targetRole = ROLES.ADMIN;

		await interaction.deferReply({ ephemeral: true });

		try {
			await container.services.permission.assignRole(user.id, targetRole, interaction.user.id);
			await interaction.editReply(`✅ Promoted **${user.username}** to **${targetRole}**.`);
		} catch (error) {
			await interaction.editReply(`❌ Error: ${(error as Error).message}`);
		}
	}
}
