import { EmbedBuilder, ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PermissionService } from '../../../../application/admin.service';

export class RoleHandler {
  constructor(_permissionService: PermissionService) {}

  async handle(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, _action?: string, _subject?: string, _data?: string): Promise<void> {
    // Note: In a real app, listing all roles might be complex. 
    // For now we just show a dashboard to add/manage.
    const embed = new EmbedBuilder()
      .setTitle('👥 Staff Role Management')
      .setDescription('Manage Admin and Sudo privileges.')
      .addFields(
        { name: 'Admin', value: 'Full access to all settings and mappings.', inline: true },
        { name: 'Sudo', value: 'Can manage mappings but not system config.', inline: true }
      )
      .setColor('#3498db') // Blue
      .setFooter({ text: 'Use /admin setrole to assign roles manually.' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Back to Menu')
                .setCustomId('nav_main')
                .setStyle(ButtonStyle.Secondary)
        );

    // Future: Add a "List Staff" button or functionality here.
    
    if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: [row] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }
}
