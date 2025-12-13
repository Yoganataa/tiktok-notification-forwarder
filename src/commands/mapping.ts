// src/commands/mapping.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  GuildChannel
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { UserMapping } from '@prisma/client';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { EMBED_COLORS, DISCORD_LIMITS } from '../constants';
import type { TikTokUsername } from '../types';
import { permission } from '../services/permission';

/**
 * Slash command definition for managing user mappings
 */
export const mappingCommand = new SlashCommandBuilder()
  .setName('mapping')
  .setDescription('Manage TikTok user to channel mappings')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add or update a user mapping')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('TikTok username (without @)')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(DISCORD_LIMITS.USERNAME_LENGTH)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Target channel for notifications')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a user mapping')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('TikTok username to remove')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(DISCORD_LIMITS.USERNAME_LENGTH)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all active mappings')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('Get information about a specific mapping')
      .addStringOption(option =>
        option
          .setName('username')
          .setDescription('TikTok username to check')
          .setRequired(true)
      )
  );



/**
 * Main handler for mapping command interactions
 * 
 * @param interaction - Chat input command interaction
 * @returns Promise that resolves when command is handled
 * 
 * @remarks
 * Defers reply to prevent timeout on slow database operations
 * All errors are logged and shown to user as ephemeral messages
 */
export async function handleMappingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  // Permission check: only Sudo users or higher can use mapping commands
  try {
    const isSudo = await permission.isSudoOrHigher(interaction.user.id);
    
    if (!isSudo) {
      await interaction.reply({ 
        content: '⛔ You do not have permission to use this command.', 
        ephemeral: true 
      });
      return;
    }
    // Additional permission check for 'remove' subcommand
    if (subcommand === 'remove') {
      const isAdmin = await permission.isAdminOrHigher(interaction.user.id);
      if (!isAdmin) {
         await interaction.reply({ 
          content: '⛔ Only Administrators can remove mappings.', 
          ephemeral: true 
        });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: true });
    
    const handler = getSubcommandHandler(subcommand);
    await handler(interaction);

  } catch (error) {
    logger.error('Error handling mapping command', {
      subcommand,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId
    });

    await safeEditReply(
      interaction,
      '❌ An error occurred while processing your request. Please try again.'
    );
  }
}

/**
 * Gets appropriate handler function for subcommand
 * 
 * @param subcommand - Subcommand name
 * @returns Handler function
 * @throws Error if subcommand is unknown
 */
function getSubcommandHandler(
  subcommand: string
): (interaction: ChatInputCommandInteraction) => Promise<void> {
  const handlers: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
    add: handleAdd,
    remove: handleRemove,
    list: handleList,
    info: handleInfo
  };

  const handler = handlers[subcommand];
  if (!handler) {
    throw new Error(`Unknown subcommand: ${subcommand}`);
  }

  return handler;
}

/**
 * Handles the 'add' subcommand - creates or updates a mapping
 * 
 * @param interaction - Command interaction
 */
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const username = sanitizeUsername(interaction.options.getString('username', true));
  const channel = interaction.options.getChannel('channel', true) as GuildChannel;

  if (!channel.isTextBased()) {
    await interaction.editReply({
      embeds: [createErrorEmbed('The selected channel must be a text channel.')]
    });
    return;
  }

  const mapping = await withRetry(() =>
    prisma.userMapping.upsert({
      where: { username },
      update: { 
        channelId: channel.id,
        updatedAt: new Date()
      },
      create: {
        username,
        channelId: channel.id
      }
    })
  );

  const isUpdate = mapping.createdAt.getTime() !== mapping.updatedAt.getTime();

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.SUCCESS)
    .setTitle(isUpdate ? '✅ Mapping Updated' : '✅ Mapping Created')
    .addFields(
      { name: 'Username', value: `@${mapping.username}`, inline: true },
      { name: 'Channel', value: `<#${mapping.channelId}>`, inline: true },
      { name: 'Action', value: isUpdate ? 'Updated existing' : 'Created new', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Configured by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });

  logger.info('Mapping added/updated', {
    username: mapping.username,
    channelId: mapping.channelId,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    isUpdate
  });
}

/**
 * Handles the 'remove' subcommand - deletes a mapping
 * 
 * @param interaction - Command interaction
 */
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const username = sanitizeUsername(interaction.options.getString('username', true));

  const deleted = await withRetry(() =>
    prisma.userMapping.delete({
      where: { username }
    }).catch(() => null)
  );

  if (!deleted) {
    await interaction.editReply({
      embeds: [createErrorEmbed(`No mapping found for username: @${username}`)]
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.ERROR)
    .setTitle('🗑️ Mapping Removed')
    .addFields(
      { name: 'Username', value: `@${deleted.username}`, inline: true },
      { name: 'Previous Channel', value: `<#${deleted.channelId}>`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Removed by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });

  logger.info('Mapping removed', {
    username: deleted.username,
    channelId: deleted.channelId,
    userId: interaction.user.id,
    guildId: interaction.guildId
  });
}

/**
 * Handles the 'list' subcommand - shows all mappings
 * 
 * @param interaction - Command interaction
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const mappings = await withRetry(() =>
    prisma.userMapping.findMany({
      orderBy: { username: 'asc' }
    })
  );

  if (mappings.length === 0) {
    await interaction.editReply({
      embeds: [createInfoEmbed('No mappings configured yet.', '📋 Empty List')]
    });
    return;
  }

  const embed = createListEmbed(mappings, interaction.user.tag);
  await interaction.editReply({ embeds: [embed] });

  logger.info('Mappings listed', {
    count: mappings.length,
    userId: interaction.user.id,
    guildId: interaction.guildId
  });
}

/**
 * Handles the 'info' subcommand - shows specific mapping details
 * 
 * @param interaction - Command interaction
 */
async function handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const username = sanitizeUsername(interaction.options.getString('username', true));

  const mapping = await withRetry(() =>
    prisma.userMapping.findUnique({
      where: { username }
    })
  );

  if (!mapping) {
    await interaction.editReply({
      embeds: [createErrorEmbed(`No mapping found for username: @${username}`)]
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO)
    .setTitle('ℹ️ Mapping Information')
    .addFields(
      { name: 'Username', value: `@${mapping.username}`, inline: true },
      { name: 'Channel', value: `<#${mapping.channelId}>`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(mapping.createdAt.getTime() / 1000)}:R>`, inline: true },
      { name: 'Last Updated', value: `<t:${Math.floor(mapping.updatedAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('Mapping info retrieved', {
    username: mapping.username,
    userId: interaction.user.id,
    guildId: interaction.guildId
  });
}

/**
 * Creates a formatted list embed for multiple mappings
 * 
 * @param mappings - Array of user mappings
 * @param requestedBy - Username who requested the list
 * @returns Formatted Discord embed
 */
function createListEmbed(mappings: UserMapping[], requestedBy: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO)
    .setTitle('📋 Active Mappings')
    .setDescription(`Total mappings: **${mappings.length}**`)
    .setTimestamp()
    .setFooter({ text: `Requested by ${requestedBy}` });

  const fields = chunkMappings(mappings);
  
  fields.forEach((field, index) => {
    embed.addFields({
      name: index === 0 ? 'Mappings' : '\u200B',
      value: field,
      inline: false
    });
  });

  return embed;
}

/**
 * Chunks mappings into field-sized strings to prevent Discord API limits
 * 
 * @param mappings - Array of user mappings
 * @returns Array of formatted strings for embed fields
 */
function chunkMappings(mappings: UserMapping[]): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const mapping of mappings) {
    const line = `• @${mapping.username} → <#${mapping.channelId}>\n`;
    
    if ((currentChunk + line).length > DISCORD_LIMITS.EMBED_FIELD_LENGTH) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Creates a standardized error embed
 * 
 * @param message - Error message to display
 * @returns Error embed
 */
function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.ERROR)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();
}

/**
 * Creates a standardized info embed
 * 
 * @param message - Info message to display
 * @param title - Optional custom title
 * @returns Info embed
 */
function createInfoEmbed(message: string, title = 'ℹ️ Information'): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO)
    .setTitle(title)
    .setDescription(message)
    .setTimestamp();
}

/**
 * Sanitizes username input by converting to lowercase and removing @
 * 
 * @param username - Raw username input
 * @returns Sanitized username
 */
function sanitizeUsername(username: string): TikTokUsername {
  return username.toLowerCase().replace(/^@/, '').trim();
}

/**
 * Safely edits reply with error handling
 * 
 * @param interaction - Command interaction
 * @param content - Content to reply with
 */
async function safeEditReply(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<void> {
  try {
    if (interaction.deferred) {
      await interaction.editReply(content);
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (error) {
    logger.error('Failed to edit reply', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: interaction.user.id
    });
  }
}