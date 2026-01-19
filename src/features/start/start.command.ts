import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const startCommand = new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start interaction with the bot');

export async function handleStartCommand(interaction: ChatInputCommandInteraction) {
    const embed = {
        title: '👋 Welcome to TikTok Forwarder Bot',
        description: 'Production-ready Discord bot to forward TikTok notifications.\nUse the menu below to configure.',
        color: 0x0099ff
    };

    const row = {
        type: 1,
        components: [
            { type: 2, style: 2, label: 'Help', customId: 'btn_help' },
            { type: 2, style: 2, label: 'About', customId: 'btn_about' },
            { type: 2, style: 1, label: 'Menu', customId: 'btn_open_menu' }
        ]
    };

    // @ts-ignore
    await interaction.reply({ embeds: [embed], components: [row] });
}
