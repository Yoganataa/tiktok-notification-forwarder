import { DownloadEngine, DownloadResult } from './types';
import { getProvider } from './hans-lib/core/src';
import { fetchBuffer } from '../../../shared/utils/network';

export class HansEngine implements DownloadEngine {
  name = 'hans';

  async download(url: string): Promise<DownloadResult> {
    const provider = getProvider('random');
    if (!provider) throw new Error('No provider available');
    const result = await provider.fetch(url);

    if (result.video && result.video.urls && result.video.urls.length > 0) {
        const videoUrl = result.video.urls[0];
        const buffer = await fetchBuffer(videoUrl);
        return {
            type: 'video',
            buffer,
            urls: result.video.urls
        };
    }

    if (result.slides && result.slides.length > 0) {
        const buffer = await fetchBuffer(result.slides[0]);
        return {
            type: 'image',
            buffer,
            urls: result.slides
        };
    }

    throw new Error('No media found');
  }
}
