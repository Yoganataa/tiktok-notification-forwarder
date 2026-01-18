import { DownloadEngine, DownloadResult } from './types';
import { Downloader } from './toby-lib/index';
import { fetchBuffer } from '../../../shared/utils/network';

export class TobyEngine implements DownloadEngine {
  name = 'tobyg74';

  async download(url: string): Promise<DownloadResult> {
    const result = await Downloader(url, { version: 'v1' });
    if (result.status !== 'success' || !result.result) {
       throw new Error(`Toby downloader failed: ${result.message}`);
    }

    const data = result.result;

    if (data.type === 'image' && data.images && data.images.length > 0) {
       const buffer = await fetchBuffer(data.images[0]);
       return {
         type: 'image',
         buffer,
         urls: data.images
       };
    }

    if (data.type === 'video' && data.video) {
        const videoUrl = (data.video.downloadAddr && data.video.downloadAddr[0]) || (data.video.playAddr && data.video.playAddr[0]);
        if (!videoUrl) throw new Error('No video URL');

        const buffer = await fetchBuffer(videoUrl);
        return {
            type: 'video',
            buffer,
            urls: [videoUrl]
        };
    }

    throw new Error('Unknown media type');
  }
}
