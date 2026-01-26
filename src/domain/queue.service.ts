import { Client } from 'discord.js';
import { QueueRepository, QueueJob } from '../infrastructure/repositories/queue.repository';
import { DownloaderService } from './downloader.service';
import { NotificationService } from './notification.service';
import { SystemConfigRepository } from '../infrastructure/repositories/system-config.repository';
import { logger } from '../shared/utils/logger';
import { NotificationData, ForwardConfig } from '../types';
import { sendChunkedMessage } from '../shared/utils/discord-chunker';

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
    private notificationService: NotificationService,
    private systemConfigRepo: SystemConfigRepository
  ) {}

  async enqueue(payload: QueuePayload): Promise<void> {
    await this.repository.enqueue(payload);
  }

  async processQueue(client: Client): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const jobs = await this.repository.getPending(5);
      for (const job of jobs) {
        await this.processJob(client, job);
      }
    } catch (error) {
      logger.error('Error in processQueue', { error: (error as Error).message });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(client: Client, job: QueueJob): Promise<void> {
    const payload = job.payload as QueuePayload;
    const { url, channelId, roleId, notificationData, sourceServer, isCrossServer } = payload;

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

      const forwardConfig: ForwardConfig = {
        channelId,
        isCrossServer: isCrossServer,
        sourceServerName: sourceServer,
        roleId
      };

      const embed = this.notificationService.createEmbed(notificationData, forwardConfig);

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
              const MAX_SIZE = 24 * 1024 * 1024; // 24MB margin
              try {
                  // sendChunkedMessage handles splitting array of files into batches of 10
                  await sendChunkedMessage(channel as any, content || undefined, [embed], files);
              } catch (sendError) {
                  if ((sendError as Error).message.includes('too large') || (sendError as Error).message.includes('413')) {
                     logger.warn('Failed to send file(s), falling back to link', { error: (sendError as Error).message });
                     await (channel as any).send({ content: content + url, embeds: [embed] });
                  } else {
                      throw sendError;
                  }
              }
          } else {
              // No files found (media object existed but no buffer?), fallback
               await (channel as any).send({ content: content + url, embeds: [embed] });
          }
      } else {
          try {
            await (channel as any).send({ content: content + url, embeds: [embed] });
          } catch (e) {
            logger.error('Failed to send fallback message', { error: (e as Error).message });
            // If we can't even send the link, fail the job
            throw e;
          }
      }

      await this.repository.markDone(job.id);

    } catch (error) {
      logger.error('Job processing failed', { jobId: job.id, error: (error as Error).message });
      if (job.attempts >= 3) {
         await this.repository.markFailed(job.id);
      }
    }
  }
}
