import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

export default class PinterestEngine extends BaseDownloadEngine {
    get name(): string {
        return 'pinterest';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[PinterestEngine] Fetching data for: ${url}`);

            const encodedUrl = encodeURIComponent(url);
            const fullUrl = `https://www.savepin.app/download.php?url=${encodedUrl}&lang=en&type=redirect`;

            const response = await axios.get(fullUrl, {
                headers: {
                    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "accept-language": "en-US,en;q=0.9",
                    "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    Referer: "https://www.savepin.app/",
                },
            });

            const $ = cheerio.load(response.data);
            const results: { quality: string; format: string; url: string }[] = [];

            $("tbody tr").each((_, el) => {
                const quality = $(el).find(".video-quality").text().trim();
                const format = $(el).find("td:nth-child(2)").text().trim();
                const href = $(el).find("a").attr("href");
                const directUrl = decodeURIComponent(href?.split("url=")[1] || "");

                if (quality && format && directUrl) {
                    results.push({
                        quality,
                        format,
                        url: directUrl,
                    });
                }
            });

            if (results.length === 0) {
                 throw new Error("No download links found");
            }

            // Prefer highest quality
            const bestResult = results[0];
            const buffer = await this.fetchBuffer(bestResult.url);

            const type = bestResult.format.toLowerCase().includes('mp4') ? 'video' : 'image';

            return {
                type: type,
                buffer: buffer,
                urls: [bestResult.url]
            };

        } catch (error) {
            logger.error(`[PinterestEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
