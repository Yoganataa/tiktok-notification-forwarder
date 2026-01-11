
import { EmbedBuilder, ButtonInteraction, ChatInputCommandInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { DiscordClientWrapper } from '../../../../../../interfaces/discord/client';

export class ServerHandler {
  constructor(private readonly clientWrapper: DiscordClientWrapper) {}

  async handle(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, _action?: string, _subject?: string, _data?: string): Promise<void> {
    const guilds = this.clientWrapper.client.guilds.cache;
    const coreServerId = process.env.GUILD_ID || '';

    const serverList = guilds.map((guild) => {
      const isCore = guild.id === coreServerId ? '👑 **(Core)**' : '';
      return `- **${guild.name}** \`[${guild.id}]\` ${isCore} - ${guild.memberCount} members`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🖥️ Connected Servers')
      .setDescription(`The bot is currently active in **${guilds.size}** servers.\n\n${serverList}`)
      .setColor('#95a5a6') // Gray
      .setTimestamp();

    if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: [] });
    } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
