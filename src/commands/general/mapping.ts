import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';
import { configManager } from '../../core/config/config';
import { container } from '@sapphire/framework';
import { ROLES } from '../../types/database.types';

@ApplyOptions<Subcommand.Options>({
	description: 'Manage channel mappings and staff roles',
	subcommands: [
		{ name: 'add', chatInputRun: 'addRun' },
		{ name: 'promote', chatInputRun: 'promoteRun' },
		{ name: 'demote', chatInputRun: 'demoteRun' }
	],
	preconditions: ['CoreServerOnly', 'SudoOnly']
})
export class MappingCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
				.addSubcommand((command) =>
					command
						.setName('add')
						.setDescription('Add a new user mapping')
						.addStringOption((option) =>
							option.setName('username').setDescription('TikTok Username').setRequired(true)
						)
						.addChannelOption((option) =>
							option.setName('channel').setDescription('Discord Channel').setRequired(true)
						)
						.addRoleOption((option) =>
							option.setName('role').setDescription('Role to ping').setRequired(false)
						)
				)
				.addSubcommand((command) =>
					command
						.setName('promote')
						.setDescription('Promote a user to staff')
						.addUserOption((option) =>
							option.setName('user').setDescription('Discord User').setRequired(true)
						)
						.addStringOption((option) =>
                            option.setName('role').setDescription('Role (ADMIN/SUDO)').setRequired(true)
                                  .addChoices(
                                      { name: 'Admin', value: 'ADMIN' },
                                      { name: 'Sudo', value: 'SUDO' }
                                  )
                        )
				)
				.addSubcommand((command) =>
					command
						.setName('demote')
						.setDescription('Remove staff access from a user')
						.addUserOption((option) =>
							option.setName('user').setDescription('Discord User').setRequired(true)
						)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public async addRun(interaction: Subcommand.ChatInputCommandInteraction) {
		const username = interaction.options.getString('username', true);
		const channel = interaction.options.getChannel('channel', true);
		const role = interaction.options.getRole('role');

        if (!channel) return;

		await interaction.deferReply({ ephemeral: true });

		try {
			await container.repos.userMapping.upsert(
                username,
                channel.id,
                role ? role.id : null
            );
			await interaction.editReply(`✅ Mapping added: **${username}** -> <#${channel.id}> ${role ? `(<@&${role.id}>)` : ''}`);
		} catch (error) {
			await interaction.editReply(`❌ Error: ${(error as Error).message}`);
		}
	}

	public async promoteRun(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!await container.services.permission.isAdminOrHigher(interaction.user.id)) {
            return interaction.reply({ content: '⛔ Admin Only.', ephemeral: true });
        }

		const user = interaction.options.getUser('user', true);
		const roleStr = interaction.options.getString('role', true);

        let role = roleStr === 'ADMIN' ? ROLES.ADMIN : ROLES.SUDO;

		await interaction.deferReply({ ephemeral: true });

		try {
			await container.services.permission.assignRole(user.id, role, interaction.user.id);
			await interaction.editReply(`✅ Promoted **${user.username}** to **${role}**.`);
		} catch (error) {
			await interaction.editReply(`❌ Error: ${(error as Error).message}`);
		}
	}

	public async demoteRun(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!await container.services.permission.isAdminOrHigher(interaction.user.id)) {
            return interaction.reply({ content: '⛔ Admin Only.', ephemeral: true });
        }

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
