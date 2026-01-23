import { BaseDownloadEngine, DownloadResult } from '../../../core/contracts/module.contract';
import { ttdl } from 'btch-downloader';
import { fetchBuffer } from '../../../shared/utils/network';
import { logger } from '../../../shared/utils/logger';

export default class BtchEngine extends BaseDownloadEngine {
  name = 'btch';

  async download(url: string): Promise<DownloadResult> {
    logger.info(`[BtchEngine] Downloading ${url}`);

    // ttdl returns a Promise<TikTokResponse>
    const result = await ttdl(url);

    if (!result) throw new Error('Empty response from btch-downloader');

    // Handle image slides
    if (result.video && result.video.length === 0 && (result as any).images && (result as any).images.length > 0) {
       const imageUrls = (result as any).images as string[];
       const buffers = await Promise.all(
           imageUrls.map(img => fetchBuffer(img))
       );
       return {
         type: 'image',
         buffers,
         buffer: buffers[0],
         urls: imageUrls
       };
    }

    // Handle video
    if (result.video && result.video.length > 0) {
      // Btch usually returns multiple URLs. The first one might be the highest quality (largest).
      // We can try to fetch metadata or just try the first one.
      // Since we hit 25MB limits, let's try to check headers first?
      // fetchBuffer checks Content-Length if we implemented it, but let's just try downloading.

      const videoUrl = result.video[0];
      const buffer = await fetchBuffer(videoUrl);
      return {
        type: 'video',
        buffer,
        urls: result.video
      };
    }

    throw new Error('No media found');
  }
}
