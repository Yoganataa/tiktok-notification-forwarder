import { DownloadEngine, DownloadResult } from './types';
import { getVideo } from './vette-lib/tiktok';
import { fetchBuffer } from '../../../shared/utils/network';
import { logger } from '../../../shared/utils/logger';

export class VetteEngine implements DownloadEngine {
  name = 'vette';

  async download(url: string): Promise<DownloadResult> {
    logger.info(`[VetteEngine] Downloading ${url}`);

    // Use the local library adapted from Vette1123
    const result = await getVideo(url);

    if (result.status !== 'success' || !result.result) {
        throw new Error(result.message || 'Failed to download video using Vette engine');
    }

    const downloadUrl = result.result.url;

    if (downloadUrl) {
      const buffer = await fetchBuffer(downloadUrl);
      return {
        type: 'video',
        buffer,
        urls: [downloadUrl]
      };
    }

    throw new Error('No media URL found in Vette response');
  }
}
