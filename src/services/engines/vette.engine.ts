import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import { fetchBuffer } from '../../shared/utils/network';
import { logger } from '../../shared/utils/logger';
import { Downloader } from './vette-lib/downloader';

export default class VetteEngine extends BaseDownloadEngine {
  name = 'vette';
  private downloader = new Downloader();

  async download(url: string): Promise<DownloadResult> {
    logger.info(`[VetteEngine] Downloading ${url}`);

    try {
        const result = await this.downloader.downloadVideo(url);

        if (!result) {
            throw new Error('Failed to download video (Vette)');
        }

        // Check for photo carousel first
        if (result.isPhotoCarousel && result.images && result.images.length > 0) {
             logger.info(`[VetteEngine] Processing ${result.images.length} images`);
             const buffers = await Promise.all(
                 result.images.map(img => fetchBuffer(img.url).catch(() => null))
             );

             const validBuffers = buffers.filter((b): b is Buffer => b !== null);

             return {
                 type: 'image',
                 buffers: validBuffers,
                 buffer: validBuffers[0],
                 urls: result.images.map(img => img.url).filter((u): u is string => !!u)
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

        throw new Error('No media found in Vette response');

    } catch (error) {
        logger.error(`[VetteEngine] Error: ${(error as Error).message}`);
        throw error;
    }
  }
}
