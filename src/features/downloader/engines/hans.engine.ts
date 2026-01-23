import { BaseDownloadEngine, DownloadResult } from '../../../core/contracts/module.contract';
import { getProvider } from './hans-lib/core/src';
import { fetchBuffer } from '../../../shared/utils/network';

export default class HansEngine extends BaseDownloadEngine {
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

        const buffer = await fetchBuffer(videoUrl);

        // Check for small files (likely error pages)
        if (buffer.length < 10000) { // 10KB
             const content = buffer.toString('utf-8', 0, 100).toLowerCase();
             if (content.includes('<!doctype html') || content.includes('<html') || content.includes('error') || content.includes('403 forbidden')) {
                 throw new Error(`Provider returned an error page instead of video (${buffer.length} bytes)`);
             }
             throw new Error(`Downloaded file is suspicious/too small (${buffer.length} bytes)`);
        }

        return {
            type: 'video',
            buffer,
            urls: result.video.urls
        };
    }

    if (result.slides && result.slides.length > 0) {
        const buffers = await Promise.all(
            result.slides.map(img => fetchBuffer(img))
        );
        return {
            type: 'image',
            buffers,
            buffer: buffers[0],
            urls: result.slides
        };
    }

    throw new Error('No media found');
  }
}
