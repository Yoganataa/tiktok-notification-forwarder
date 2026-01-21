import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ForwarderService } from '../forwarder/forwarder.service';
import { PermissionService } from './permission.service';
import { configManager } from '../../core/config/config';
import { logger } from '../../shared/utils/logger';

export const reforgotCommand = new SlashCommandBuilder()
  .setName('reforgot')
  .setDescription('Reprocess unacknowledged notifications from a starting message ID')
  .addStringOption(option =>
      option.setName('message_id')
        .setDescription('The Message ID to start scanning from (exclusive)')
        .setRequired(true)
  );

export async function handleReforgotCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService,
  forwarderService: ForwarderService
) {
    const messageId = interaction.options.getString('message_id', true);

    // 1. Permission Check
    const isSudo = await permissionService.isSudoOrHigher(interaction.user.id);
    if (!isSudo) {
        await interaction.reply({ content: '⛔ Permission denied.', ephemeral: true });
        return;
    }

    if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: '❌ command must be run in a text channel.', ephemeral: true });
        return;
    }

    await interaction.deferReply();
    const config = configManager.get();
    const sourceBotIds = config.bot.sourceBotIds;
    const ownerId = config.discord.ownerId;

    let scanned = 0;
    let processed = 0;
    let skipped = 0;
    let lastId = messageId;
    let hasMore = true;

    try {
        while (hasMore) {
            const messages = await interaction.channel.messages.fetch({ limit: 100, after: lastId });

            if (messages.size === 0) {
                hasMore = false;
                break;
            }

            // Collection is sorted by ID ascending (oldest -> newest) when using 'after'
            for (const message of messages.values()) {
                scanned++;

                // Match Logic (Must duplicate basics to avoid processing non-targets)
                const isTarget = sourceBotIds.includes(message.author.id) || message.author.id === ownerId;

                if (isTarget) {
                    const hasReaction = message.reactions.cache.some(r => r.me);

                    if (hasReaction) {
                        skipped++;
                    } else {
                        await forwarderService.processMessage(message);
                        processed++;
                    }
                }
            }

            lastId = messages.last()?.id || lastId;
            if (messages.size < 100) {
                hasMore = false;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🔄 Reforgot Execution Complete')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Start ID', value: messageId, inline: true },
                { name: 'Scanned', value: scanned.toString(), inline: true },
                { name: 'Reprocessed', value: processed.toString(), inline: true },
                { name: 'Already Handled', value: skipped.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Reforgot command failed', { error: (error as Error).message });
        await interaction.editReply(`❌ Error executing reforgot: ${(error as Error).message}`);
    }
}
