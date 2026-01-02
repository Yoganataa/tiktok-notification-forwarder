// src/commands/admin.command.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { PermissionService } from '../services/permission.service';
import { ROLES, UserRole } from '../core/types/database.types';

/**
 * Slash Command Definition for Admin Management.
 * * Defines the structure for the `/admin` command, which allows privileged users
 * to manage roles and revoke access within the system.
 * * Default Permission: Administrator.
 */
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
            // Menggunakan konstanta ROLES, bukan string manual 'ADMIN'
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

/**
 * Handles the execution of the `/admin` slash command.
 * * Validates the caller's permissions and routes the request to the appropriate
 * subcommand handler (setrole or revoke).
 * * @param interaction - The interaction object triggered by the command.
 * * @param permissionService - The service responsible for handling role assignments and access control.
 */
export async function handleAdminCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService
): Promise<void> {
  // Guard clause: Ensure the user has adequate permissions within the bot's system
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
      // Type casting menggunakan UserRole agar type-safe
      const role = interaction.options.getString('role', true) as UserRole;

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