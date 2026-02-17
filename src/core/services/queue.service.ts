import { Client } from 'discord.js';
import { QueueRepository, QueueJob } from '../repositories/queue.repository';
import { DownloaderService } from '../downloader/downloader.service';
import { DiscordNotificationService } from '../../discord/services/notification.service';
import { TelegramService } from '../../telegram/services/telegram.service';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { logger } from '../utils/logger';
import { NotificationData, ForwardConfig } from '../types';
import { sendChunkedMessage } from '../../discord/utils/discord-chunker';

export interface QueuePayload {
  url: string;
  username: string;
  channelId: string;
  roleId?: string | null;
  notificationData: NotificationData;
  sourceServer?: string;
  isCrossServer: boolean;
}

export class QueueService {
  private isProcessing = false;

  constructor(
    private repository: QueueRepository,
    private downloader: DownloaderService,
    private discordService: DiscordNotificationService,
    private telegramService: TelegramService,
    private systemConfigRepo: SystemConfigRepository
  ) {}

  async enqueue(payload: QueuePayload): Promise<void> {
    await this.repository.enqueue(payload);
  }

  async processQueue(discordClient: Client): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const jobs = await this.repository.getPending(5);
      for (const job of jobs) {
        await this.processJob(discordClient, job);
      }
    } catch (error) {
      logger.error('Error in processQueue', { error: (error as Error).message });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(discordClient: Client, job: QueueJob): Promise<void> {
    const payload = job.payload as QueuePayload;
    const { url, username } = payload;

    try {
      await this.repository.incrementAttempts(job.id);

      const autoDownload = (await this.systemConfigRepo.get('AUTO_DOWNLOAD')) !== 'false';
      let media: any = null;

      if (autoDownload) {
          try {
            media = await this.downloader.download(url);
          } catch (e) {
            logger.warn(`Download failed for job ${job.id}, falling back to link.`, { error: (e as Error).message });
          }
      }

      // Execute in parallel
      const results = await Promise.allSettled([
          this.processDiscord(discordClient, payload, media),
          this.processTelegram(username, url, media)
      ]);

      // Check if both failed? Or just mark done if at least one succeeded?
      // Usually if one critical path succeeds, we mark done.
      // Assuming Discord is critical as per original design, but let's be lenient.
      const rejected = results.filter(r => r.status === 'rejected');
      if (rejected.length > 0) {
          rejected.forEach((r: any) => logger.error('Partial failure in job processing', { error: r.reason }));
      }

      await this.repository.markDone(job.id);

    } catch (error) {
      logger.error('Job processing failed', { jobId: job.id, error: (error as Error).message });
      if (job.attempts >= 3) {
         await this.repository.markFailed(job.id);
      }
    }
  }

  private async processDiscord(client: Client, payload: QueuePayload, media: any): Promise<void> {
      const { url, channelId, roleId, notificationData, sourceServer, isCrossServer } = payload;

      const forwardConfig: ForwardConfig = {
        channelId,
        isCrossServer: isCrossServer,
        sourceServerName: sourceServer,
        roleId
      };

      const embed = this.discordService.createEmbed(notificationData, forwardConfig);

      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
         throw new Error(`Channel ${channelId} not found or not text based`);
      }

      let content = '';
      if (roleId) {
        content = `<@&${roleId}> `;
      }

      if (media) {
          const files: any[] = [];

          if (media.type === 'video' && media.buffer) {
              files.push({ attachment: media.buffer, name: 'video.mp4' });
          } else if (media.type === 'image') {
              if (media.buffers && media.buffers.length > 0) {
                  media.buffers.forEach((buf: Buffer, index: number) => {
                      files.push({ attachment: buf, name: `image_${index + 1}.jpg` });
                  });
              } else if (media.buffer) {
                  files.push({ attachment: media.buffer, name: 'image.jpg' });
              }
          }

          if (files.length > 0) {
              try {
                  await sendChunkedMessage(channel as any, content || undefined, [embed], files);
              } catch (sendError) {
                  if ((sendError as Error).message.includes('too large') || (sendError as Error).message.includes('413')) {
                     logger.warn('Failed to send file(s) to Discord, falling back to link', { error: (sendError as Error).message });
                     await (channel as any).send({ content: content + url, embeds: [embed] });
                  } else {
                      throw sendError;
                  }
              }
          } else {
               await (channel as any).send({ content: content + url, embeds: [embed] });
          }
      } else {
          await (channel as any).send({ content: content + url, embeds: [embed] });
      }
  }

  private async processTelegram(username: string, url: string, media: any): Promise<void> {
      try {
          // getOrCreateTopic returns string | null now
          const topicId = await this.telegramService.getOrCreateTopic(username);
          if (!topicId) {
              logger.warn(`Skipping Telegram for ${username}: Could not get topic.`);
              return;
          }

          if (media) {
             if (media.type === 'video' && media.buffer) {
                 await this.telegramService.sendVideo(topicId, media.buffer, url);
             } else if (media.type === 'image') {
                 // Send message link for photo
                 await this.telegramService.sendMessage(topicId, `📸 New Photo: ${url}`);
             }
          } else {
              await this.telegramService.sendMessage(topicId, `🔗 ${url}`);
          }

      } catch (error) {
          logger.error('Failed to process Telegram job', { error: (error as Error).message });
          // We don't throw here to avoid failing the whole job if Discord succeeded
      }
  }
}
