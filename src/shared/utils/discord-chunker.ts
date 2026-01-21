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
    // Cast to any to bypass PartialGroupDMChannel type issue, assuming channel is a TextChannel or similar
    const target = channel as any;

    if (files.length <= MAX_ATTACHMENTS) {
        return [await target.send({ content, embeds, files })];
    }

    const chunks = chunkArray(files, MAX_ATTACHMENTS);
    const sentMessages: Message[] = [];

    // Send the first chunk with the main content and embeds
    try {
        const firstMessage = await target.send({
            content,
            embeds,
            files: chunks[0]
        });
        sentMessages.push(firstMessage);

        // Send subsequent chunks with just the files
        for (let i = 1; i < chunks.length; i++) {
            const followUp = await target.send({
                files: chunks[i]
            });
            sentMessages.push(followUp);
        }
    } catch (error) {
        logger.error('Failed to send chunked message', { error: (error as Error).message });
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
    if (files.length <= MAX_ATTACHMENTS) {
        await interaction.editReply({ content, embeds, files });
        return;
    }

    const chunks = chunkArray(files, MAX_ATTACHMENTS);

    // Edit the initial reply with the first chunk
    await interaction.editReply({
        content,
        embeds,
        files: chunks[0]
    });

    // Send subsequent chunks as follow-ups
    for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
            files: chunks[i]
        });
    }
}
