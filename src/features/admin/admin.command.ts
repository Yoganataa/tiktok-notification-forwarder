import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BaseCommand } from '../../core/contracts/module.contract';
import { AppContext } from '../../index';

export default class AdminCommand extends BaseCommand {
    get definition() {
        return new SlashCommandBuilder()
            .setName('admin')
            .setDescription('Manage user roles (Owner only)')
            .addSubcommand((sub) =>
                sub
                    .setName('setrole')
                    .setDescription('Assign a role to a user')
                    .addUserOption((opt) =>
                        opt.setName('user').setDescription('Target user').setRequired(true)
                    )
                    .addStringOption((opt) =>
                        opt.setName('role').setDescription('Role to assign').setRequired(true)
                            .addChoices({ name: 'Admin', value: 'ADMIN' }, { name: 'Sudo', value: 'SUDO' })
                    )
            )
            .addSubcommand((sub) =>
                sub
                    .setName('revoke')
                    .setDescription('Revoke all roles from a user')
                    .addUserOption((opt) =>
                        opt.setName('user').setDescription('Target user').setRequired(true)
                    )
            );
    }

    async execute(interaction: ChatInputCommandInteraction, context: AppContext): Promise<void> {
        const { permissionService } = context;
        if (!permissionService) return;

        if (!(await permissionService.isAdminOrHigher(interaction.user.id))) {
            await interaction.reply({ content: '⛔ Only Admins can use this.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user', true);

        try {
            if (subcommand === 'setrole') {
                const role = interaction.options.getString('role', true);
                // @ts-ignore
                await permissionService.assignRole(targetUser.id, role, interaction.user.id);
                await interaction.reply({ content: `✅ Updated **${targetUser.tag}** to role **${role}**`, ephemeral: true });
            } else if (subcommand === 'revoke') {
                await permissionService.revokeAccess(targetUser.id);
                await interaction.reply({ content: `🗑️ Revoked access for **${targetUser.tag}**`, ephemeral: true });
            }
        } catch (error) {
            await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
        }
    }
}
