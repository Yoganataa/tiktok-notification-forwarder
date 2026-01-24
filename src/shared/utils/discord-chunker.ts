import {
    AttachmentBuilder,
    TextBasedChannel,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    Message
} from 'discord.js';
import { logger } from './logger';

const MAX_ATTACHMENTS = 10;

/**
 * Splits an array into chunks of a specified size.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/**
 * Sends a message with attachments, automatically splitting them into multiple messages if needed.
 * This is designed for TextChannels (used by QueueService).
 */
export async function sendChunkedMessage(
    channel: TextBasedChannel,
    content: string | undefined,
    embeds: EmbedBuilder[] = [],
    files: any[] = []
): Promise<Message[]> {
    const target = channel as any;
    const sentMessages: Message[] = [];

    const chunks = chunkArray(files, MAX_ATTACHMENTS);

    // If no files, just send content/embeds
    if (chunks.length === 0) {
        return [await target.send({ content, embeds })];
    }

    // Send the first chunk with the main content and embeds
    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isFirst = i === 0;

            if (isFirst) {
                const msg = await target.send({
                    content,
                    embeds,
                    files: chunk
                });
                sentMessages.push(msg);
            } else {
                const msg = await target.send({
                    files: chunk
                });
                sentMessages.push(msg);
            }
        }
    } catch (error) {
        logger.error('Failed to send chunked message', { error: (error as Error).message });
        // Propagate error so caller can fallback
        throw error;
    }

    return sentMessages;
}

/**
 * Replies to an interaction with attachments, automatically splitting them into multiple messages if needed.
 * This is designed for Slash Commands (used by TikTokCommand).
 */
export async function sendChunkedReply(
    interaction: ChatInputCommandInteraction,
    content: string | undefined,
    embeds: EmbedBuilder[] = [],
    files: any[] = []
): Promise<void> {
    const chunks = chunkArray(files, MAX_ATTACHMENTS);

    if (chunks.length === 0) {
        await interaction.editReply({ content, embeds });
        return;
    }

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (i === 0) {
            await interaction.editReply({
                content,
                embeds,
                files: chunk
            });
        } else {
            await interaction.followUp({
                files: chunk
            });
        }
    }
}
