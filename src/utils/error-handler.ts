// src/utils/error-handler.ts
import { Interaction, EmbedBuilder } from 'discord.js';
import { logger } from './logger';

/**
 * Centralized error handling mechanism for Discord interactions.
 * * Intercepts unhandled exceptions during command or component execution.
 * * Logs detailed context (User ID, Command Name, Stack Trace) to the system logger.
 * * Delivers a user-friendly, ephemeral error message to the Discord client, ensuring
 * the user is not left waiting indefinitely.
 * * @param interaction - The interaction instance where the error occurred.
 * @param error - The exception object thrown during execution.
 */
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
    .setTitle('🛑 System Encountered an Error')
    .setDescription(
      'An unexpected internal error occurred while processing your request.\n\n' +
      '**What happened?**\n' +
      `\`${error.message}\``
    )
    .setFooter({ text: 'Our engineers have been notified.' })
    .setTimestamp();

  try {
    if (!interaction.isRepliable()) return;

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  } catch (e) {
    logger.error('Double Fault: Failed to send error feedback to user', { 
        internalError: (e as Error).message 
    });
  }
}