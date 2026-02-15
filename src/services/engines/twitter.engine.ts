import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../shared/utils/logger';

/**
 * Twitter / X Engine (Ported from Source A: twitterService.js)
 * Uses savetwitter.net API for fetching Twitter/X media.
 */
export default class TwitterEngine extends BaseDownloadEngine {
    get name(): string {
        return 'twitter';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[TwitterEngine] Fetching data for: ${url}`);

            const endpoint = "https://savetwitter.net/api/ajaxSearch";

            const form = new URLSearchParams({
                q: url,
                lang: "en",
                cftoken: "",
            });

            const { data } = await axios.post(endpoint, form.toString(), {
                headers: {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "origin": "https://savetwitter.net",
                    "referer": "https://savetwitter.net/en4",
                    "x-requested-with": "XMLHttpRequest",
                    "user-agent":
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                },
                timeout: 15000,
            });

            if (data.status !== "ok") {
                throw new Error("Failed to fetch Twitter media (API status not ok)");
            }

            const $ = cheerio.load(data.data);

            const videos: { quality: string, url: string }[] = [];
            const images: { url: string }[] = [];

            // Video links
            $(".tw-button-dl").each((_, el) => {
                const href = $(el).attr("href");
                const text = $(el).text();

                if (!href || !href.includes("dl.snapcdn.app")) return;

                // MP4 videos
                if (text.includes("MP4")) {
                    const qualityMatch = text.match(/\((\d+p)\)/);
                    videos.push({
                        quality: qualityMatch ? qualityMatch[1] : "unknown",
                        url: href,
                    });
                }

                // Image download button (from Source A logic)
                if (text.includes("图片")) { // "Picture" in Chinese/Source Logic
                    images.push({ url: href });
                }
            });

            // Photo-only tweets (Source A logic)
            $(".photo-list img").each((_, img) => {
                const src = $(img).attr("src");
                if (src) images.push({ url: src });
            });

            // Sort videos: highest → lowest quality
            videos.sort((a, b) => {
                const qa = parseInt(a.quality) || 0;
                const qb = parseInt(b.quality) || 0;
                return qb - qa;
            });

            if (videos.length > 0) {
                 const bestVideo = videos[0];
                 logger.info(`[TwitterEngine] Found video: ${bestVideo.quality}`);
                 const buffer = await this.fetchBuffer(bestVideo.url);
                 return {
                     type: 'video',
                     buffer: buffer,
                     urls: [bestVideo.url]
                 };
            } else if (images.length > 0) {
                 logger.info(`[TwitterEngine] Found ${images.length} images.`);
                 const buffers = await Promise.all(images.map(img => this.fetchBuffer(img.url)));
                 return {
                     type: 'image',
                     buffers: buffers,
                     urls: images.map(i => i.url)
                 };
            } else {
                throw new Error("No media found on Twitter URL.");
            }

        } catch (error) {
             logger.error(`[TwitterEngine] Error: ${(error as Error).message}`);
             throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
