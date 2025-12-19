// src/commands/menu.command.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { PermissionService } from '../services/permission.service';

export const menuCommand = new SlashCommandBuilder()
  .setName('menu')
  .setDescription('Open Admin Control Panel (Owner/Admin Only)');

export async function handleMenuCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService
): Promise<void> {
  if (!(await permissionService.isAdminOrHigher(interaction.user.id))) {
    await interaction.reply({
      content: '⛔ Access Denied. This panel is restricted to Administrators.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎛️ System Control Panel')
    .setColor(0x2b2d31)
    .setDescription('Admin control panel')
    .addFields(
      { name: '⚙️ Environment', value: 'View configuration', inline: true },
      { name: '👥 Roles', value: 'Manage staff', inline: true },
      { name: '🖥️ Servers', value: 'View guilds', inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('nav_env')
      .setLabel('Environment')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId('nav_roles')
      .setLabel('Role Manager')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥'),
    new ButtonBuilder()
      .setCustomId('nav_servers')
      .setLabel('Servers')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🖥️')
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}