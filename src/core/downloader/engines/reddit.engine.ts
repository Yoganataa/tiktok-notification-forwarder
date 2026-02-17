import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

/**
 * Reddit Engine (Ported from Source A: redditService.js)
 * Uses RapidSave API for fetching Reddit media.
 */
export default class RedditEngine extends BaseDownloadEngine {
    get name(): string {
        return 'reddit';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[RedditEngine] Fetching data for: ${url}`);

            const rapidUrl = `https://rapidsave.com/info?url=${encodeURIComponent(url)}`;

            const res = await axios.get(rapidUrl, {
                headers: {
                    "accept": "text/html",
                    "user-agent": "Mozilla/5.0",
                    "referer": "https://rapidsave.com/",
                },
            });

            const $ = cheerio.load(res.data);

            const downloadUrl = $("a.downloadbutton").attr("href");

            if (!downloadUrl) {
                throw new Error("Download link not found");
            }

            logger.info(`[RedditEngine] Found media URL: ${downloadUrl}`);
            const buffer = await this.fetchBuffer(downloadUrl);

            // Determine type based on URL extension or basic heuristic
            // RapidSave usually returns MP4 for videos.
            // If it's an image post, logic might differ, but based on Source A, it returns a single URL.
            // We assume video for now as "rapidsave" implies video/gif, but checking extension is safer.
            const type = (downloadUrl.endsWith('.jpg') || downloadUrl.endsWith('.png') || downloadUrl.endsWith('.jpeg'))
                ? 'image'
                : 'video';

            return {
                type: type,
                buffer: buffer,
                urls: [downloadUrl]
            };

        } catch (error) {
             logger.error(`[RedditEngine] Error: ${(error as Error).message}`);
             throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
