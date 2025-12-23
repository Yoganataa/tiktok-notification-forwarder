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

/**
 * Slash Command Definition for the Admin Control Panel.
 * * Defines the `/menu` command structure.
 * * This command is the entry point for the interactive dashboard system.
 */
export const menuCommand = new SlashCommandBuilder()
  .setName('menu')
  .setDescription('Open Admin Control Panel (Owner/Admin Only)');

/**
 * Handles the execution of the `/menu` slash command.
 * * Validates user permissions and renders the main System Control Panel embed
 * with interactive navigation buttons.
 * * @param interaction - The interaction object triggered by the command.
 * @param permissionService - Service to validate user access rights.
 */
export async function handleMenuCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService
): Promise<void> {
  // 1. Verify access rights
  if (!(await permissionService.isAdminOrHigher(interaction.user.id))) {
    await interaction.reply({
      content: '⛔ Access Denied. This panel is restricted to Administrators.',
      ephemeral: true,
    });
    return;
  }

  // 2. Construct the main dashboard embed
  const embed = new EmbedBuilder()
    .setTitle('🎛️ System Control Panel')
    .setColor(0x2b2d31)
    .setDescription('Select a module to manage:')
    .addFields(
      { name: '🗺️ Mappings', value: 'Manage TikTok users', inline: true },
      { name: '⚙️ Environment', value: 'Edit configuration', inline: true },
      { name: '👥 Roles', value: 'Manage staff', inline: true },
      { name: '🖥️ Servers', value: 'View guilds', inline: true }
    )
    .setTimestamp();

  // 3. Configure navigation buttons (Row 1: Operational)
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('nav_mappings')
      .setLabel('Mappings')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🗺️'),
    new ButtonBuilder()
      .setCustomId('nav_env')
      .setLabel('Environment')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️')
  );

  // 4. Configure navigation buttons (Row 2: Administrative)
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('nav_roles')
      .setLabel('Roles')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥'),
    new ButtonBuilder()
      .setCustomId('nav_servers')
      .setLabel('Servers')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🖥️')
  );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true,
  });
}