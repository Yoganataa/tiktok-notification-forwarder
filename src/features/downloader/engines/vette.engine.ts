import { DownloadEngine, DownloadResult } from '../types';
import { fetchBuffer } from '../../../shared/utils/network';
import { logger } from '../../../shared/utils/logger';
import { Downloader } from './vette-lib/downloader';

export class VetteEngine implements DownloadEngine {
  name = 'vette';
  private downloader = new Downloader();

  async download(url: string): Promise<DownloadResult> {
    logger.info(`[VetteEngine] Downloading ${url}`);

    try {
        const result = await this.downloader.downloadVideo(url);

        if (!result) {
            throw new Error('Failed to download video');
        }

        // Check for photo carousel first (similar to API logic)
        if (result.images && result.images.length > 0) {
             const buffer = await fetchBuffer(result.images[0].url);
             return {
                 type: 'image',
                 buffer,
                 urls: result.images.map(img => img.url)
             };
        }

        // Handle video
        const downloadUrl = result.downloadUrl;
        if (downloadUrl) {
             const buffer = await fetchBuffer(downloadUrl);
             return {
                 type: 'video',
                 buffer,
                 urls: [downloadUrl]
             };
        }

        throw new Error('No media found in response');

    } catch (error) {
        logger.error(`[VetteEngine] Error: ${(error as Error).message}`);
        throw error;
    }
  }
}
