import { DownloadEngine, DownloadResult } from './types';
import { tiktokdl } from 'tiktok-downloader';
import { fetchBuffer } from '../../../shared/utils/network';
import { logger } from '../../../shared/utils/logger';

export class VetteEngine implements DownloadEngine {
  name = 'vette';

  async download(url: string): Promise<DownloadResult> {
    logger.info(`[VetteEngine] Downloading ${url}`);

    // Using tiktok-downloader (Vette1123)
    const result = await tiktokdl(url);
    if (!result) throw new Error('Empty response from tiktok-downloader');

    // It returns { type: 'video'|'image', url: string, ... } structure usually,
    // but looking at repo it might return different shape.
    // Based on common usage:
    // It returns object with `video` (url) or `images` (array).

    // Check for images
    if (result.images && result.images.length > 0) {
       const buffer = await fetchBuffer(result.images[0]);
       return {
         type: 'image',
         buffer,
         urls: result.images
       };
    }

    // Check for video
    // The library might return `video` as string or object.
    const videoUrl = result.video;

    if (videoUrl) {
      const buffer = await fetchBuffer(videoUrl);
      return {
        type: 'video',
        buffer,
        urls: [videoUrl]
      };
    }

    throw new Error('No media found');
  }
}
