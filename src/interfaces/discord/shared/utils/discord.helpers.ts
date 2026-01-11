// src/interfaces/discord/shared/utils/discord.helpers.ts
import { EmbedBuilder, ColorResolvable, EmbedFooterData } from 'discord.js';
import { EMBED_COLORS, APP_VERSION } from '../../../../shared/constants';
import { configManager } from '../../../../infra/config/config';

/**
 * Generates the standardized footer object.
 * * Format: "Engine: <ENGINE> | v<VERSION>"
 * * Safe to call even if config is not fully loaded (graceful fallback).
 */
export function getStandardFooter(extraText?: string): EmbedFooterData {
  let engine = 'UNKNOWN';
  try {
    // Lazy load config to avoid circular dependency issues during boot
    engine = configManager.get().bot.downloaderEngine.toUpperCase();
  } catch {
    engine = 'BOOTING';
  }

  const baseText = `Engine: ${engine} | v${APP_VERSION}`;
  return {
    text: extraText ? `${baseText} | ${extraText}` : baseText
  };
}

/**
 * Generates a standardized 'Success' style Embed.
 */
export function createSuccessEmbed(
  title: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.SUCCESS as ColorResolvable)
    .setTitle(`✅ ${title}`)
    .setFooter(getStandardFooter()) // <--- Auto Footer
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Generates a standardized 'Error' style Embed.
 */
export function createErrorEmbed(
  title: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.ERROR as ColorResolvable)
    .setTitle(`❌ ${title}`)
    .setFooter(getStandardFooter()) // <--- Auto Footer
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Generates a standardized 'Info' style Embed.
 */
export function createInfoEmbed(
  title: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO as ColorResolvable)
    .setTitle(`ℹ️ ${title}`)
    .setFooter(getStandardFooter()) // <--- Auto Footer
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

// ... (fungsi chunkText tetap sama)
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