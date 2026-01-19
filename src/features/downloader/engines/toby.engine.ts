import { DownloadEngine, DownloadResult } from './types';
import TobyLib from './toby-lib/index';
import { fetchBuffer } from '../../../shared/utils/network';

export class TobyEngine implements DownloadEngine {
  name = 'tobyg74';
  private version: 'v1' | 'v2' | 'v3' = 'v1';

  setVersion(v: 'v1' | 'v2' | 'v3') {
      this.version = v;
  }

  async download(url: string): Promise<DownloadResult> {
    const result = await TobyLib.Downloader(url, { version: this.version });

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
        // Some providers return array, some object? Types say video: string[] | ...
        const videoUrl = (Array.isArray(data.video) ? data.video[0] : data.video) as string;

        if (!videoUrl) throw new Error('No video URL');

        const buffer = await fetchBuffer(videoUrl);
        return {
            type: 'video',
            buffer,
            urls: Array.isArray(data.video) ? data.video : [videoUrl]
        };
    }

    throw new Error('Unknown media type');
  }
}
