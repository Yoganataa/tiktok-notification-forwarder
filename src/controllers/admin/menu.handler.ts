// src/controllers/admin/menu.handler.ts
import { RepliableInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export class MenuHandler {
    async show(interaction: RepliableInteraction): Promise<void> {
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

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('nav_mappings').setLabel('Mappings').setStyle(ButtonStyle.Success).setEmoji('🗺️'),
            new ButtonBuilder().setCustomId('nav_env').setLabel('Environment').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('nav_roles').setLabel('Roles').setStyle(ButtonStyle.Primary).setEmoji('👥'),
            new ButtonBuilder().setCustomId('nav_servers').setLabel('Servers').setStyle(ButtonStyle.Secondary).setEmoji('🖥️')
        );

        const payload = { embeds: [embed], components: [row1, row2], ephemeral: true };

        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            await (interaction as any).update(payload);
        } else {
            await interaction.reply(payload);
        }
    }
}