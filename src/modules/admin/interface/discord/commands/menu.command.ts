
import { SlashCommandBuilder } from 'discord.js';

export const menuCommand = new SlashCommandBuilder()
  .setName('menu')
  .setDescription('Open the System Control Panel (Admin Only)');
