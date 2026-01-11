// src/modules/forwarder/infra/discord-notifier.adapter.ts
import { AttachmentBuilder, EmbedBuilder, TextChannel } from 'discord.js';
import { NotifierPort } from '../ports/notifier.port';
import { DownloadResult } from '../../tiktok/domain';
import { DiscordClientWrapper } from '../../../interfaces/discord/client';
import { logger } from '../../../infra/logger';
import { EMBED_COLORS } from '../../../shared/constants';
// IMPORT HELPER BARU
import { getStandardFooter } from '../../../interfaces/discord/shared/utils/discord.helpers';

export class DiscordNotifierAdapter implements NotifierPort {
  constructor(private clientWrapper: DiscordClientWrapper) {}

  async notify(channelId: string, message: string, media?: DownloadResult, roleIdToTag?: string | null, eventId?: string): Promise<void> {
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

    let content = message;
    if (roleIdToTag) {
        content = `<@&${roleIdToTag}> ${content}`;
    }

    const embeds: EmbedBuilder[] = [];
    let files: AttachmentBuilder[] = [];

    // GUNAKAN STANDARD FOOTER DENGAN EXTRA TEXT (Event ID)
    const footerData = getStandardFooter(eventId ? `Event: ${eventId}` : undefined);

    if (media) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.TIKTOK)
            .setAuthor({ name: media.author || 'TikTok' })
            .setDescription(media.description || '')
            .setFooter(footerData) // <--- Updated
            .setTimestamp();
        
        embeds.push(embed);

        if (media.type === 'video' && media.urls.length > 0) {
             files.push(new AttachmentBuilder(media.urls[0], { name: 'video.mp4' }));
        } else if (media.type === 'image') {
             files = media.urls.slice(0, 4).map((u, i) => new AttachmentBuilder(u, { name: `image${i}.jpg` }));
        }
    } else if (eventId) {
         const embed = new EmbedBuilder()
            .setDescription('Notification')
            .setFooter(footerData) // <--- Updated
            .setTimestamp();
         embeds.push(embed);
    }

    try {
        await textChannel.send({ content, embeds, files });
    } catch (error) {
        // Fallback if file too large
        if (media && media.urls.length > 0) {
            await textChannel.send({ 
                content: `${content}\n\n⚠️ Media too large to upload directly:\n${media.urls[0]}`,
                embeds 
            });
        } else {
            logger.error('Failed to send notification', { error: (error as Error).message });
        }
    }
  }
}
