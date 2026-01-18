import { Client } from 'discord.js';
import { QueueRepository, QueueJob } from '../../core/repositories/queue.repository';
import { DownloaderService } from '../downloader/downloader.service';
import { NotificationService } from '../notification/notification.service';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { logger } from '../../shared/utils/logger';
import { NotificationData, ForwardConfig } from '../../core/types';

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

      if (media && media.buffer) {
          const files = [];
          if (media.type === 'video') files.push({ attachment: media.buffer, name: `video.mp4` });
          else if (media.type === 'image') files.push({ attachment: media.buffer, name: `image.jpg` });

          const MAX_SIZE = 25 * 1024 * 1024;
          if (media.buffer.length > MAX_SIZE) {
             await (channel as any).send({ content: content + url, embeds: [embed] });
          } else {
             await (channel as any).send({
                content: content || undefined,
                embeds: [embed],
                files: files
             });
          }
      } else {
          await (channel as any).send({ content: content + url, embeds: [embed] });
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
