import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  GuildChannel,
} from 'discord.js';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { PermissionService } from '../../features/admin/permission.service';
import { logger } from '../../shared/utils/logger';
import { withRetry } from '../../shared/utils/retry';
import { EMBED_COLORS, DISCORD_LIMITS } from '../../constants';
import { ValidationError } from '../../core/errors/validation.error';

const userMappingRepo = new UserMappingRepository();

export const mappingCommand = new SlashCommandBuilder()
  .setName('mapping')
  .setDescription('Add or update a mapping')
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
  );

export async function handleMappingCommand(
  interaction: ChatInputCommandInteraction,
  permissionService: PermissionService
): Promise<void> {
  try {
    const isSudo = await permissionService.isSudoOrHigher(interaction.user.id);
    if (!isSudo) {
      await interaction.reply({
        content: '⛔ You do not have permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const username = sanitizeUsername(interaction.options.getString('username', true));
    const channel = interaction.options.getChannel('channel', true) as GuildChannel;

    if (!channel.isTextBased()) {
        throw new ValidationError('Channel must be text-based');
    }

    const mapping = await withRetry(() =>
        userMappingRepo.upsert(username, channel.id)
    );

    const isUpdate = mapping.created_at.getTime() !== mapping.updated_at.getTime();

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS)
        .setTitle(isUpdate ? '✅ Mapping Updated' : '✅ Mapping Created')
        .addFields(
            { name: 'Username', value: `@${mapping.username}`, inline: true },
            { name: 'Channel', value: `<#${mapping.channel_id}>`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('Error handling mapping command', {
      error: (error as Error).message,
      userId: interaction.user.id,
    });
    await interaction.editReply(`❌ Error: ${(error as Error).message}`);
  }
}

function sanitizeUsername(username: string): string {
  return username.toLowerCase().replace(/^@/, '').trim();
}
