import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  GuildChannel,
  EmbedBuilder,
} from 'discord.js';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { BaseCommand } from '../../core/contracts/module.contract';
import { AppContext } from '../../index';
import { logger } from '../../shared/utils/logger';
import { withRetry } from '../../shared/utils/retry';
import { EMBED_COLORS, DISCORD_LIMITS } from '../../constants';
import { ValidationError } from '../../core/errors/validation.error';

export default class MappingCommand extends BaseCommand {
    get definition() {
        return new SlashCommandBuilder()
            .setName('mapping')
            .setDescription('Add or update a mapping')
            .addStringOption((opt) =>
                opt.setName('username').setDescription('TikTok username (without @)')
                    .setRequired(true).setMinLength(1).setMaxLength(DISCORD_LIMITS.USERNAME_LENGTH)
            )
            .addChannelOption((opt) =>
                opt.setName('channel').setDescription('Target channel for notifications')
                    .setRequired(true).addChannelTypes(ChannelType.GuildText)
            );
    }

    async execute(interaction: ChatInputCommandInteraction, context: AppContext): Promise<void> {
        const { permissionService } = context;
        const userMappingRepo = new UserMappingRepository();

        try {
            if (!permissionService || !(await permissionService.isSudoOrHigher(interaction.user.id))) {
                await interaction.reply({ content: '⛔ You do not have permission.', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const username = sanitizeUsername(interaction.options.getString('username', true));
            const channel = interaction.options.getChannel('channel', true) as GuildChannel;

            if (!channel.isTextBased()) {
                throw new ValidationError('Channel must be text-based');
            }

            const mapping = await withRetry(() => userMappingRepo.upsert(username, channel.id));

            const createdTime = new Date(mapping.created_at).getTime();
            const updatedTime = new Date(mapping.updated_at).getTime();
            const isUpdate = createdTime !== updatedTime;

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
            logger.error('Error handling mapping command', { error: (error as Error).message });
            await interaction.editReply(`❌ Error: ${(error as Error).message}`);
        }
    }
}

function sanitizeUsername(username: string): string {
  return username.replace(/^@/, '').trim();
}
