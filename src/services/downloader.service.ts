import { ttdl } from 'btch-downloader';
import { Downloader } from '@tobyg74/tiktok-api-dl';
import { logger } from '../utils/logger';

export interface DownloadResult {
  type: 'video' | 'image';
  buffer?: Buffer;
  url?: string;
  urls: string[];
}

export class DownloaderService {
  async download(url: string): Promise<DownloadResult> {
    try {
      return await this.downloadPrimary(url);
    } catch (primaryError) {
      logger.warn('Primary downloader failed, attempting fallback', { error: (primaryError as Error).message, url });
      try {
        return await this.downloadFallback(url);
      } catch (fallbackError) {
        logger.error('All downloaders failed', { error: (fallbackError as Error).message, url });
        throw fallbackError;
      }
    }
  }

  private async downloadPrimary(url: string): Promise<DownloadResult> {
    const result = await ttdl(url);
    if (!result) throw new Error('Empty response from btch-downloader');

    // Check for images (slideshow)
    // Note: btch-downloader structure might vary, but typically 'images' array is present for slides
    // or 'video' array for videos.
    // Based on docs and logs, 'video' is present.

    // Check if images exist (some versions might put it in images property)
    // The previous test script output showed "video": [...] and "audio": [...]
    // If it is a slideshow, btch-downloader often returns "images" array.

    if ((result as any).images && (result as any).images.length > 0) {
       const imageUrls = (result as any).images as string[];
       const buffer = await this.fetchBuffer(imageUrls[0]);
       return {
         type: 'image',
         buffer,
         urls: imageUrls
       };
    }

    if (result.video && result.video.length > 0) {
      const videoUrl = result.video[0];
      const buffer = await this.fetchBuffer(videoUrl);
      return {
        type: 'video',
        buffer,
        urls: result.video
      };
    }

    throw new Error('No media found in btch-downloader response');
  }

  private async downloadFallback(url: string): Promise<DownloadResult> {
    const result = await Downloader(url, { version: 'v1' });
    if (result.status !== 'success' || !result.result) {
       throw new Error(`Fallback downloader failed: ${result.message}`);
    }

    const data = result.result;

    if (data.type === 'image' && data.images && data.images.length > 0) {
       const buffer = await this.fetchBuffer(data.images[0]);
       return {
         type: 'image',
         buffer,
         urls: data.images
       };
    }

    if (data.type === 'video' && data.video) {
        // Try playAddr or downloadAddr
        // In v1 response: playAddr is string[], downloadAddr is string[]
        const videoUrl = (data.video.downloadAddr && data.video.downloadAddr[0]) || (data.video.playAddr && data.video.playAddr[0]);
        if (!videoUrl) throw new Error('No video URL in fallback response');

        const buffer = await this.fetchBuffer(videoUrl);
        return {
            type: 'video',
            buffer,
            urls: [videoUrl]
        };
    }

    throw new Error('Unknown media type in fallback response');
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
