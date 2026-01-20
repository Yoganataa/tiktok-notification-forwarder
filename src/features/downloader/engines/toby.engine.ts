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

    const data = result.result as any;

    // Handle v3 (MusicalDown) which might use 'video' type but different properties
    // or sometimes type 'image' but with 'images' array.

    if (data.type === 'image' && data.images && data.images.length > 0) {
       const buffer = await fetchBuffer(data.images[0]);
       return {
         type: 'image',
         buffer,
         urls: data.images
       };
    }

    // Try to find video URL in common fields across v1, v2, v3
    let videoUrl: string | undefined;

    if (data.type === 'video') {
        if (this.version === 'v1') { // TiktokAPI
             // data.video is object Video
             if (data.video?.downloadAddr && data.video.downloadAddr.length > 0) videoUrl = data.video.downloadAddr[0];
             else if (data.video?.playAddr && data.video.playAddr.length > 0) videoUrl = data.video.playAddr[0];
        } else if (this.version === 'v2') { // SSSTik
             // data.video is object { playAddr: string[] }
             if (data.video?.playAddr && data.video.playAddr.length > 0) videoUrl = data.video.playAddr[0];
        } else if (this.version === 'v3') { // MusicalDown
             // data has videoHD, videoSD, videoWatermark direct properties
             videoUrl = data.videoHD || data.videoSD || data.videoWatermark;
        }
    } else if (data.type === 'music') {
         // Fallback if it detected as music but we want video? Or just fail.
         throw new Error('Media is audio only');
    }

    if (!videoUrl && data.video) {
        // Fallback generic extraction if structure unknown
        if (typeof data.video === 'string') videoUrl = data.video;
        else if (Array.isArray(data.video)) videoUrl = data.video[0];
    }

    if (!videoUrl) throw new Error('No video URL found in response');

    const buffer = await fetchBuffer(videoUrl);
    return {
        type: 'video',
        buffer,
        urls: [videoUrl]
    };
  }
}
