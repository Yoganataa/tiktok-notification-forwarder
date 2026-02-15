import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
// @ts-ignore
import snapsave from 'metadownloader';
import { logger } from '../../shared/utils/logger';
import axios from 'axios';

export default class FacebookInstaEngine extends BaseDownloadEngine {
    get name(): string {
        return 'facebook-insta'; // Handles both 'facebook' and 'instagram' platforms
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[FacebookInstaEngine] Fetching data for: ${url}`);

            // metadownloader (snapsave) handles both FB and Insta
            const result = await snapsave(url);

            if (!result) {
                throw new Error("No data returned from metadownloader");
            }

            // Check if result is video or image(s)
            // metadownloader usually returns an object. We need to inspect it.
            // Based on typical snapsave output: could be a direct URL or an array.

            // Assuming result structure based on usage patterns (often returns direct video URL or list)
            // But let's look at source usage: `const result = await snapsave(url); return result;`
            // Source API just returns `data: result`.

            // We need to adapt it to DownloadResult (buffer/buffers).

            // If result is a string (URL)
            if (typeof result === 'string') {
                 const buffer = await this.fetchBuffer(result);
                 return {
                     type: 'video', // Default assumption if string
                     buffer: buffer,
                     urls: [result]
                 };
            }

            // If result has type/url property
             if (result.url) {
                 const buffer = await this.fetchBuffer(result.url);
                 return {
                     type: 'video',
                     buffer: buffer,
                     urls: [result.url]
                 };
            }

            // If result is array (Slideshow?)
            if (Array.isArray(result)) {
                 const buffers = await Promise.all(result.map((u: string) => this.fetchBuffer(u)));
                 return {
                     type: 'image',
                     buffers: buffers,
                     urls: result
                 };
            }

            // Fallback: try to find 'data' property
             if (result.data && Array.isArray(result.data)) {
                 const buffers = await Promise.all(result.data.map((u: string) => this.fetchBuffer(u)));
                 return {
                     type: 'image',
                     buffers: buffers,
                     urls: result.data
                 };
            }

            throw new Error(`Unknown response format from metadownloader: ${JSON.stringify(result)}`);

        } catch (error) {
            logger.error(`[FacebookInstaEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
