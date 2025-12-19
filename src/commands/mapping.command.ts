// src/commands/mapping.command.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  GuildChannel,
} from 'discord.js';
import { UserMappingRepository } from '../repositories/user-mapping.repository';
import { PermissionService } from '../services/permission.service';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { EMBED_COLORS, DISCORD_LIMITS } from '../constants';
import { ValidationError } from '../core/errors/validation.error';
import { RecordNotFoundError } from '../core/errors/database.error';

// Initialize repository
const userMappingRepo = new UserMappingRepository();

export const mappingCommand = new SlashCommandBuilder()
  .setName('mapping')
  .setDescription('Manage TikTok user to channel mappings')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add or update a user mapping')
      .addStringOption((opt) =>
        opt
          .setName('username')
          .setDescription('TikTok username (without @)')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(DISCORD_LIMITS.USERNAME_LENGTH)
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target channel for notifications')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a user mapping')
      .addStringOption((opt) =>
        opt
          .setName('username')
          .setDescription('TikTok username to remove')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all active mappings')
  )
  .addSubcommand((sub) =>
    sub
      .setName('info')
      .setDescription('Get information about a specific mapping')
      .addStringOption((opt) =>
        opt
          .setName('username')
          .setDescription('TikTok username to check')
          .setRequired(true)
      )
  );

export async function handleMappingCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    // Permission check
    const isSudo = await permissionService.isSudoOrHigher(interaction.user.id);
    if (!isSudo) {
      await interaction.reply({
        content: '⛔ You do not have permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    // Additional check for remove
    if (subcommand === 'remove') {
      const isAdmin = await permissionService.isAdminOrHigher(
        interaction.user.id
      );
      if (!isAdmin) {
        await interaction.reply({
          content: '⛔ Only Administrators can remove mappings.',
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: true });

    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'info':
        await handleInfo(interaction);
        break;
    }
  } catch (error) {
    logger.error('Error handling mapping command', {
      subcommand,
      error: (error as Error).message,
      userId: interaction.user.id,
    });

    const message =
      error instanceof ValidationError || error instanceof RecordNotFoundError
        ? error.message
        : '❌ An error occurred while processing your request.';

    await safeEditReply(interaction, message);
  }
}

async function handleAdd(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = sanitizeUsername(
    interaction.options.getString('username', true)
  );
  const channel = interaction.options.getChannel(
    'channel',
    true
  ) as GuildChannel;

  if (!channel.isTextBased()) {
    throw new ValidationError('The selected channel must be a text channel.');
  }

  const mapping = await withRetry(() =>
    userMappingRepo.upsert(username, channel.id)
  );

  const isUpdate =
    mapping.created_at.getTime() !== mapping.updated_at.getTime();

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.SUCCESS)
    .setTitle(isUpdate ? '✅ Mapping Updated' : '✅ Mapping Created')
    .addFields(
      { name: 'Username', value: `@${mapping.username}`, inline: true },
      { name: 'Channel', value: `<#${mapping.channel_id}>`, inline: true },
      {
        name: 'Action',
        value: isUpdate ? 'Updated existing' : 'Created new',
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: `Configured by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });

  logger.info('Mapping added/updated', {
    username: mapping.username,
    channelId: mapping.channel_id,
    userId: interaction.user.id,
    isUpdate,
  });
}

async function handleRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = sanitizeUsername(
    interaction.options.getString('username', true)
  );

  const deleted = await withRetry(() => userMappingRepo.delete(username));

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.ERROR)
    .setTitle('🗑️ Mapping Removed')
    .addFields(
      { name: 'Username', value: `@${deleted.username}`, inline: true },
      {
        name: 'Previous Channel',
        value: `<#${deleted.channel_id}>`,
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: `Removed by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });

  logger.info('Mapping removed', {
    username: deleted.username,
    userId: interaction.user.id,
  });
}

async function handleList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const mappings = await withRetry(() => userMappingRepo.findAll());

  if (mappings.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.INFO)
      .setTitle('📋 Empty List')
      .setDescription('No mappings configured yet.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO)
    .setTitle('📋 Active Mappings')
    .setDescription(`Total mappings: **${mappings.length}**`)
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  // Chunk mappings to avoid exceeding Discord limits
  const chunks = chunkMappings(mappings);
  chunks.forEach((chunk, index) => {
    embed.addFields({
      name: index === 0 ? 'Mappings' : '\u200B',
      value: chunk,
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });

  logger.info('Mappings listed', {
    count: mappings.length,
    userId: interaction.user.id,
  });
}

async function handleInfo(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = sanitizeUsername(
    interaction.options.getString('username', true)
  );

  const mapping = await withRetry(() =>
    userMappingRepo.findByUsername(username)
  );

  if (!mapping) {
    throw new RecordNotFoundError('Mapping', username);
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.INFO)
    .setTitle('ℹ️ Mapping Information')
    .addFields(
      { name: 'Username', value: `@${mapping.username}`, inline: true },
      { name: 'Channel', value: `<#${mapping.channel_id}>`, inline: true },
      {
        name: 'Created',
        value: `<t:${Math.floor(mapping.created_at.getTime() / 1000)}:R>`,
        inline: true,
      },
      {
        name: 'Last Updated',
        value: `<t:${Math.floor(mapping.updated_at.getTime() / 1000)}:R>`,
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

function chunkMappings(mappings: any[]): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const mapping of mappings) {
    const line = `• @${mapping.username} → <#${mapping.channel_id}>\n`;

    if (
      (currentChunk + line).length > DISCORD_LIMITS.EMBED_FIELD_LENGTH
    ) {
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

function sanitizeUsername(username: string): string {
  return username.toLowerCase().replace(/^@/, '').trim();
}

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
      error: (error as Error).message,
      userId: interaction.user.id,
    });
  }
}