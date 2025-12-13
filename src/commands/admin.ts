// src/commands/admin.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../lib/prisma';
import { permission } from '../services/permission';
import { ROLES } from '../types';

export const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Manage user roles (Owner only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => 
    sub.setName('setrole')
      .setDescription('Assign a role to a user')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption(opt => 
        opt.setName('role')
           .setDescription('Role to assign')
           .setRequired(true)
           .addChoices(
             { name: 'Admin', value: ROLES.ADMIN },
             { name: 'Sudo User', value: ROLES.SUDO }
           )
      )
  )
  .addSubcommand(sub => 
    sub.setName('revoke')
      .setDescription('Remove access from a user')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
  );

export async function handleAdminCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!await permission.isAdminOrHigher(interaction.user.id)) {
    await interaction.reply({ content: '⛔ Only Admins can use this.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user', true);

  if (subcommand === 'setrole') {
    const role = interaction.options.getString('role', true);
    
    await prisma.accessControl.upsert({
      where: { userId: targetUser.id },
      update: { role },
      create: {
        userId: targetUser.id,
        role,
        addedBy: interaction.user.id
      }
    });

    await interaction.reply({ content: `✅ **${targetUser.tag}** is now a **${role}**`, ephemeral: true });
  
  } else if (subcommand === 'revoke') {
    await prisma.accessControl.delete({
      where: { userId: targetUser.id }
    }).catch(() => null);

    await interaction.reply({ content: `🗑️ Access revoked for **${targetUser.tag}**`, ephemeral: true });
  }
}