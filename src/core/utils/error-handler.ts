import { Interaction, EmbedBuilder } from 'discord.js';
import { logger } from './logger';

export async function handleInteractionError(interaction: Interaction, error: Error) {
  logger.error('Unhandled Interaction Error', {
    user: interaction.user.tag,
    userId: interaction.user.id,
    interactionId: interaction.id,
    command: (interaction as any).commandName || 'component_interaction',
    error: error.message,
    stack: error.stack
  });

  const errorEmbed = new EmbedBuilder()
    .setColor(0xff4b4b)
    .setTitle('🛑 Error')
    .setDescription('An unexpected error occurred.')
    .setFooter({ text: 'Reported to logs.' })
    .setTimestamp();

  try {
    if (!interaction.isRepliable()) return;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  } catch (e) {
    logger.error('Failed to send error feedback', { internalError: (e as Error).message });
  }
}
