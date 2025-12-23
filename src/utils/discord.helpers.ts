// src/utils/discord.helpers.ts
import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { EMBED_COLORS } from '../constants';

/**
 * Generates a standardized 'Success' style Embed.
 * * Pre-configured with the success color theme and a checkmark emoji.
 * * @param title - The title of the embed (automatically prefixed with ✅).
 * * @param description - Optional body text for the embed.
 * * @returns A constructed `EmbedBuilder` instance.
 */
export function createSuccessEmbed(
  title: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.SUCCESS as ColorResolvable)
    .setTitle(`✅ ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Generates a standardized 'Error' style Embed.
 * * Pre-configured with the error color theme and a cross mark emoji.
 * * @param title - The title of the embed (automatically prefixed with ❌).
 * * @param description - Optional body text for the embed.
 * * @returns A constructed `EmbedBuilder` instance.
 */
export function createErrorEmbed(
  title: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.ERROR as ColorResolvable)
    .setTitle(`❌ ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Generates a standardized 'Info' style Embed.
 * * Pre-configured with the info color theme and an information source emoji.
 * * @param title - The title of the embed (automatically prefixed with ℹ️).
 * * @param description - Optional body text for the embed.
 * * @returns A constructed `EmbedBuilder` instance.
 */
export function createInfoEmbed(
  title: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO as ColorResolvable)
    .setTitle(`ℹ️ ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Splits a long string into an array of smaller strings to fit within Discord's character limits.
 * * Tries to split by newlines first to preserve formatting.
 * * If a single line exceeds the limit, it performs a hard split on that specific line.
 * * @param text - The raw text to be split.
 * * @param maxLength - The maximum character length per chunk (e.g., 1024 for Embed Fields).
 * * @returns An array of string chunks.
 */
export function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxLength) {
      // Push the current accumulator if it exists
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // Handle edge case: Single line exceeds the maximum length
      if (line.length > maxLength) {
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}