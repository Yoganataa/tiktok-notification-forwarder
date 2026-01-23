import { BaseDownloadEngine, DownloadResult } from '../../../core/contracts/module.contract';
import TobyLib from './toby-lib/index';
import { fetchBuffer } from '../../../shared/utils/network';

export default class TobyEngine extends BaseDownloadEngine {
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

    if (data.type === 'image' && data.images && data.images.length > 0) {
       const buffers = await Promise.all(
           data.images.map((img: string) => fetchBuffer(img))
       );
       return {
         type: 'image',
         buffers,
         buffer: buffers[0],
         urls: data.images
       };
    }

    let videoUrl: string | undefined;

    if (data.type === 'video') {
        if (this.version === 'v1') {
             if (data.video?.downloadAddr && data.video.downloadAddr.length > 0) videoUrl = data.video.downloadAddr[0];
             else if (data.video?.playAddr && data.video.playAddr.length > 0) videoUrl = data.video.playAddr[0];
        } else if (this.version === 'v2') {
             if (data.video?.playAddr && data.video.playAddr.length > 0) videoUrl = data.video.playAddr[0];
        } else if (this.version === 'v3') {
             videoUrl = data.videoHD || data.videoSD || data.videoWatermark;
        }
    } else if (data.type === 'music') {
         throw new Error('Media is audio only');
    }

    if (!videoUrl && data.video) {
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
