import { Client } from 'discord.js';
import { QueueRepository, QueueJob } from '../repositories/queue.repository';
import { DownloaderService } from './downloader.service';
import { NotificationService } from './notification.service';
import { logger } from '../utils/logger';
import { NotificationData, ForwardConfig } from '../core/types';

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
    private notificationService: NotificationService
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

      const media = await this.downloader.download(url);

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

      const files = [];
      if (media.type === 'video' && media.buffer) {
         files.push({ attachment: media.buffer, name: `video.mp4` });
      } else if (media.type === 'image' && media.buffer) {
         files.push({ attachment: media.buffer, name: `image.jpg` });
      }

      let content = '';
      if (roleId) {
        content = `<@&${roleId}> `;
      }

      const MAX_SIZE = 25 * 1024 * 1024;
      const totalSize = media.buffer ? media.buffer.length : 0;

      if (totalSize > MAX_SIZE) {
         logger.warn('File too large, falling back to URL', { jobId: job.id, size: totalSize });
         await (channel as any).send({ content: content + url, embeds: [embed] });
      } else {
         await (channel as any).send({
            content: content || undefined,
            embeds: [embed],
            files: files
         });
      }

      await this.repository.markDone(job.id);

    } catch (error) {
      logger.error('Job processing failed', { jobId: job.id, error: (error as Error).message });

      // Attempt Fallback (URL only)
      try {
        const { url, channelId, roleId, notificationData, sourceServer, isCrossServer } = payload;
        const channel = await client.channels.fetch(channelId);
         if (channel && channel.isTextBased()) {
             const forwardConfig: ForwardConfig = { channelId, isCrossServer, sourceServerName: sourceServer, roleId };
             const embed = this.notificationService.createEmbed(notificationData, forwardConfig);
             let content = roleId ? `<@&${roleId}> ` : '';
             await (channel as any).send({ content: content + url, embeds: [embed] });

             await this.repository.markDone(job.id);
             return;
         }
      } catch (fallbackError) {
         logger.error('Fallback send failed', { error: (fallbackError as Error).message });
      }

      if (job.attempts >= 3) {
         await this.repository.markFailed(job.id);
      }
    }
  }
}
