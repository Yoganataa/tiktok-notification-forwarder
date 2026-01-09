// src/controllers/admin/server.handler.ts
import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { configManager } from '../../core/config/config';

export class ServerHandler {
    // Constructor dihapus karena kosong

    async showPage(interaction: ButtonInteraction): Promise<void> {
        const client = interaction.client;
        const guilds = await client.guilds.fetch();
        const config = configManager.get();
        const coreId = config.discord.coreServerId;

        const subsServers: string[] = [];
        const coreServers: string[] = [];

        for (const [id, oauthGuild] of guilds) {
            const guild = await oauthGuild.fetch();
            const line = `${guild.name} (${guild.id})`;
            if (id === coreId) coreServers.push(line);
            else subsServers.push(line);
        }

        const description = [
            `Total Servers: ${guilds.size}`,
            ``,
            `**Subs Server ID:**`,
            subsServers.length > 0 ? subsServers.join('\n') : 'None',
            ``,
            `**Core Server ID**`,
            coreServers.length > 0 ? coreServers.join('\n') : 'Not Configured'
        ].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🖥️ Server List')
            .setColor(0x2b2d31)
            .setDescription(description);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
        );

        await interaction.update({ embeds: [embed], components: [row] });
    }
}