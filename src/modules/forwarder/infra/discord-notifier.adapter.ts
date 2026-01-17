
import { AttachmentBuilder, EmbedBuilder, TextChannel } from 'discord.js';
import { NotifierPort } from '../ports/notifier.port';
import { DownloadResult } from '../../tiktok/domain';
import { DiscordClientWrapper } from '../../../interfaces/discord/client';
import { logger } from '../../../infra/logger';
import { EMBED_COLORS } from '../../../shared/constants';
import { getStandardFooter } from '../../../interfaces/discord/shared/utils/discord.helpers';
import { configManager } from '../../../infra/config/config';

export class DiscordNotifierAdapter implements NotifierPort {
  constructor(private clientWrapper: DiscordClientWrapper) {}

  async notify(
      channelId: string,
      message: string,
      media?: DownloadResult,
      roleIdToTag?: string | null,
      eventId?: string,
      sourceGuildName?: string
  ): Promise<void> {
    const channel = await this.clientWrapper.getChannel(channelId);
    if (!channel || !channel.isSendable()) {
      logger.warn(`Cannot send to channel ${channelId}`);
      return;
    }

    const textChannel = channel as TextChannel;

    // Idempotency Check
    if (eventId) {
        try {
            const messages = await textChannel.messages.fetch({ limit: 10 });
            const duplicate = messages.find(m => 
                m.embeds.some(e => e.footer?.text?.includes(`Event: ${eventId}`))
            );
            if (duplicate) {
                logger.debug(`Skipping duplicate Discord notification for Event ID: ${eventId}`);
                return;
            }
        } catch (err) {
            logger.warn('Failed to check for duplicate messages, proceeding anyway.', { error: (err as Error).message });
        }
    }

    // --- Footer Construction (Attribution) ---
    const footerExtras: string[] = [];
    if (sourceGuildName) footerExtras.push(`From Server: ${sourceGuildName}`);
    if (eventId) footerExtras.push(`Event: ${eventId}`);

    const footerData = getStandardFooter(footerExtras.length > 0 ? footerExtras.join(' | ') : undefined);

    const embeds: EmbedBuilder[] = [];
    let files: AttachmentBuilder[] = [];
    let finalContent = message;

    // --- Downloader & Content Logic ---
    if (media) {
        // Prepare Media Files
        if (media.type === 'video' && media.urls.length > 0) {
             files.push(new AttachmentBuilder(media.urls[0], { name: 'video.mp4' }));
        } else if (media.type === 'image') {
             files = media.urls.slice(0, 4).map((u, i) => new AttachmentBuilder(u, { name: `image${i}.jpg` }));
        }

        // Prepare Embed
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.TIKTOK)
            .setAuthor({
                name: media.author || 'TikTok',
                // If downloader is enabled, we might want the original link here instead of raw text
                url: configManager.get().bot.enableDownloader ? undefined : undefined
            })
            .setDescription(media.description || '')
            .setFooter(footerData)
            .setTimestamp();
        
        embeds.push(embed);
    } else {
        // No media, simple embed
        if (eventId) {
             const embed = new EmbedBuilder()
                .setDescription('Notification')
                .setFooter(footerData)
                .setTimestamp();
             embeds.push(embed);
        }
    }

    // Role Tagging
    if (roleIdToTag) {
        finalContent = `<@&${roleIdToTag}> ${finalContent}`;
    }

    try {
        await textChannel.send({ content: finalContent, embeds, files });
    } catch (error) {
        // Fallback if file too large or upload fails
        if (media && media.urls.length > 0) {
            // Force include link if upload failed
            const fallbackContent = `${finalContent}\n\n⚠️ Media upload failed (Size/Format):\n${media.urls[0]}`;
            await textChannel.send({ 
                content: fallbackContent,
                embeds 
            });
        } else {
            logger.error('Failed to send notification', { error: (error as Error).message });
        }
    }
  }
}
