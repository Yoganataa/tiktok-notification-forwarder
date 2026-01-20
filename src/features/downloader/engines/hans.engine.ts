import { DownloadEngine, DownloadResult } from './types';
import { getProvider } from './hans-lib/core/src';
import { fetchBuffer } from '../../../shared/utils/network';

export class HansEngine implements DownloadEngine {
  name = 'hans';
  private providerName: string = 'random';

  setProvider(name: string) {
      this.providerName = name;
  }

  async download(url: string): Promise<DownloadResult> {
    const provider = getProvider(this.providerName);
    if (!provider) throw new Error(`Provider ${this.providerName} not found`);

    const result = await provider.fetch(url);
    if ((result as any).error) throw new Error((result as any).error);

    if (result.video && result.video.urls && result.video.urls.length > 0) {
        // Try to find a valid URL that is not empty
        const videoUrl = result.video.urls.find(u => u && u.startsWith('http'));
        if (!videoUrl) throw new Error('No valid video URL found');

        // Check if content type is actually video or if it's a small error file
        // Note: fetchBuffer does strict check? No, shared utils fetchBuffer just does arrayBuffer.
        // We should probably check the buffer size or headers.

        const buffer = await fetchBuffer(videoUrl);

        // If buffer is suspiciously small (< 5KB), it's likely an error page/corruption
        if (buffer.length < 5000) {
             throw new Error('Downloaded file is too small (likely corrupted or error page)');
        }

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
