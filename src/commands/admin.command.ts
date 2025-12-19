// src/commands/admin.command.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { PermissionService } from '../services/permission.service';
import { ROLES } from '../core/types/database.types';

export const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Manage user roles (Owner only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('setrole')
      .setDescription('Assign a role to a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Target user').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('role')
          .setDescription('Role to assign')
          .setRequired(true)
          .addChoices(
            { name: 'Admin', value: ROLES.ADMIN },
            { name: 'Sudo User', value: ROLES.SUDO }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('revoke')
      .setDescription('Remove access from a user')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Target user').setRequired(true)
      )
  );

export async function handleAdminCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService
): Promise<void> {
  if (!(await permissionService.isAdminOrHigher(interaction.user.id))) {
    await interaction.reply({
      content: '⛔ Only Admins can use this.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user', true);

  try {
    if (subcommand === 'setrole') {
      const role = interaction.options.getString('role', true) as
        | 'ADMIN'
        | 'SUDO';

      await permissionService.assignRole(
        targetUser.id,
        role,
        interaction.user.id
      );

      await interaction.reply({
        content: `✅ **${targetUser.tag}** is now a **${role}**`,
        ephemeral: true,
      });
    } else if (subcommand === 'revoke') {
      await permissionService.revokeAccess(targetUser.id);

      await interaction.reply({
        content: `🗑️ Access revoked for **${targetUser.tag}**`,
        ephemeral: true,
      });
    }
  } catch (error) {
    await interaction.reply({
      content: `❌ ${(error as Error).message}`,
      ephemeral: true,
    });
  }
}