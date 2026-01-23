import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BaseCommand } from '../../core/contracts/module.contract';
import { ForwarderService } from '../forwarder/forwarder.service';
import { PermissionService } from './permission.service';
import { configManager } from '../../core/config/config';
import { logger } from '../../shared/utils/logger';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { AccessControlRepository } from '../../core/repositories/access-control.repository';
import { QueueRepository } from '../../core/repositories/queue.repository';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { DownloaderService } from '../downloader/downloader.service';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../queue/queue.service';

export default class ReforgotCommand extends BaseCommand {
    get definition() {
        return new SlashCommandBuilder()
            .setName('reforgot')
            .setDescription('Reprocess unacknowledged notifications from a starting message ID')
            .addStringOption(option =>
                option.setName('message_id')
                    .setDescription('The Message ID to start scanning from (exclusive)')
                    .setRequired(true)
            );
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        // DI HACK: Should be injected properly
        const userMappingRepo = new UserMappingRepository();
        const accessControlRepo = new AccessControlRepository();
        const systemConfigRepo = new SystemConfigRepository();
        const queueRepo = new QueueRepository();
        const downloaderService = new DownloaderService(systemConfigRepo);
        // Important: Init downloader to load engines if it hasn't been already (it probably has in app start, but this is a new instance)
        // Actually, we should probably instantiate these services ONCE in the App and pass them, but for this refactor scope we re-instantiate or need a container.
        // For now, re-instantiating repositories is safe (stateless). Services might be heavier.
        await downloaderService.init();

        const notificationService = new NotificationService(userMappingRepo);
        const queueService = new QueueService(queueRepo, downloaderService, notificationService, systemConfigRepo);
        const permissionService = new PermissionService(accessControlRepo);
        const forwarderService = new ForwarderService(notificationService, queueService, userMappingRepo);

        return handleReforgotCommand(interaction, permissionService, forwarderService);
    }
}

async function handleReforgotCommand(
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
