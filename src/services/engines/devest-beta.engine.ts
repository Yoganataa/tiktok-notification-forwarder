import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as qs from 'qs';
import { logger } from '../../shared/utils/logger';

/**
 * Devest Beta Engine (Ported from Source A: tiktokService.js)
 * Uses SSSTik.io for fetching TikTok data.
 */
export default class DevestBetaEngine extends BaseDownloadEngine {
    get name(): string {
        return 'devest-beta';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[DevestBetaEngine] Fetching data for: ${url}`);

            const body = qs.stringify({
                id: url,
                locale: "en",
                tt: "dHl6Ylg4",
            });

            // SSSTik request
            const res = await axios.post("https://ssstik.io/abc?url=dl", body, {
                headers: {
                    "accept": "*/*",
                    "content-type": "application/x-www-form-urlencoded",
                    "user-agent": "Mozilla/5.0",
                    "referer": "https://ssstik.io/en-1",
                    "hx-request": "true",
                    "hx-target": "target",
                    "hx-trigger": "_gcaptcha_pt",
                },
            });

            const html = res.data;
            const $ = cheerio.load(html);

            const videoDownloads: string[] = [];
            const slideDownloads: string[] = [];

            // VIDEO / AUDIO DOWNLOADS
            $("a.download_link:not(.slide)").each((_, el) => {
                const href = $(el).attr("href");
                if (href && href !== "#") {
                    videoDownloads.push(href);
                }
            });

            // PHOTO / SLIDE DOWNLOADS
            $("a.download_link.slide").each((_, el) => {
                const href = $(el).attr("href");
                if (href && href !== "#") {
                    slideDownloads.push(href);
                }
            });

            if (videoDownloads.length === 0 && slideDownloads.length === 0) {
                 throw new Error("No download links found.");
            }

            // Priority: Slideshow > Video
            if (slideDownloads.length > 0) {
                 logger.info(`[DevestBetaEngine] Found slideshow with ${slideDownloads.length} images.`);
                 // Fetch buffers for images
                 const buffers = await Promise.all(slideDownloads.map(imgUrl => this.fetchBuffer(imgUrl)));
                 return {
                    type: 'image',
                    buffers: buffers,
                    urls: slideDownloads
                 };
            } else {
                 // Video: Use the first valid link (usually "Without Watermark")
                 const videoUrl = videoDownloads[0];
                 logger.info(`[DevestBetaEngine] Found video: ${videoUrl}`);
                 const buffer = await this.fetchBuffer(videoUrl);
                 return {
                     type: 'video',
                     buffer: buffer,
                     urls: [videoUrl]
                 };
            }

        } catch (error) {
             logger.error(`[DevestBetaEngine] Error: ${(error as Error).message}`);
             throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(response.data);
        } catch (error) {
             throw new Error(`Failed to download media buffer: ${(error as Error).message}`);
        }
    }
}
