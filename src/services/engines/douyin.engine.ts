import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../shared/utils/logger';

export default class DouyinEngine extends BaseDownloadEngine {
    get name(): string {
        return 'douyin';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[DouyinEngine] Fetching data for: ${url}`);

            const params = new URLSearchParams({
                q: url,
                lang: "en",
                cftoken: "",
            });

            const response = await axios.post(
                "https://savetik.co/api/ajaxSearch",
                params.toString(),
                {
                    headers: {
                        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "x-requested-with": "XMLHttpRequest",
                        Referer: "https://savetik.co/en/douyin-downloader",
                        accept: "*/*",
                        "accept-language": "en-US,en;q=0.5",
                    },
                }
            );

            if (response.data.status !== "ok") {
                throw new Error("API returned error: " + JSON.stringify(response.data));
            }

            const $ = cheerio.load(response.data.data);

            const videoLinks: { label: string; url: string }[] = [];
            $(".tik-right .dl-action a.tik-button-dl").each((i, el) => {
                videoLinks.push({
                    label: $(el).text().trim(),
                    url: $(el).attr("href") || '',
                });
            });

            if (videoLinks.length > 0 && videoLinks[videoLinks.length - 1].label.toLowerCase().includes("profile")) {
                videoLinks.pop();
            }

            if (videoLinks.length === 0) {
                 throw new Error("No download links found for Douyin video");
            }

            const videoUrl = videoLinks[0].url; // Usually the first one is the best (No Watermark)
            logger.info(`[DouyinEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[DouyinEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
