import { SlashCommandBuilder } from 'discord.js';

export const startCommand = new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start interaction with the bot');
