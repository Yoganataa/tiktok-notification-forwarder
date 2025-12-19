// src/utils/discord.helpers.ts
import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { EMBED_COLORS } from '../constants';

/**
 * Create standardized success embed
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
 * Create standardized error embed
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
 * Create standardized info embed
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
 * Chunk text to fit Discord field limits
 */
export function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // If single line exceeds limit, split it
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