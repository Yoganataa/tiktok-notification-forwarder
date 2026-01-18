import { DownloadEngine, DownloadResult } from './types';
import { ttdl } from 'btch-downloader';
import { fetchBuffer } from '../../../shared/utils/network';

export class BtchEngine implements DownloadEngine {
  name = 'btch';

  async download(url: string): Promise<DownloadResult> {
    const result = await ttdl(url);
    if (!result) throw new Error('Empty response from btch-downloader');

    if ((result as any).images && (result as any).images.length > 0) {
       const imageUrls = (result as any).images as string[];
       const buffer = await fetchBuffer(imageUrls[0]);
       return {
         type: 'image',
         buffer,
         urls: imageUrls
       };
    }

    if (result.video && result.video.length > 0) {
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
