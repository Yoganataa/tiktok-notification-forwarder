import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

export default class ThreadsEngine extends BaseDownloadEngine {
    get name(): string {
        return 'threads';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[ThreadsEngine] Fetching data for: ${url}`);

            const endpoint = "https://lovethreads.net/api/ajaxSearch";
            const form = new URLSearchParams({
                q: url,
                t: "media",
                lang: "en",
            });

            const { data } = await axios.post(endpoint, form.toString(), {
                headers: {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    origin: "https://lovethreads.net",
                    referer: "https://lovethreads.net/en",
                    "x-requested-with": "XMLHttpRequest",
                },
            });

            if (data.status !== "ok") throw new Error("API returned status: " + data.status);

            const $ = cheerio.load(data.data);

            const photos: { index: number; thumbnail: string; variants: any[] }[] = [];
            const videos: { index: number; thumbnail: string; url: string; format: string }[] = [];

            $(".download-box > li").each((index, li) => {
                const item = $(li);

                /* ───────────── PHOTO ───────────── */
                if (item.find(".icon-dlimage").length) {
                    const thumbnail = item.find(".download-items__thumb img").attr("src") || '';
                    const variants: any[] = [];

                    item.find(".photo-option option").each((_, opt) => {
                        const url = $(opt).attr("value");
                        const label = $(opt).text().trim();

                        if (!url || !label.includes("x")) return;

                        const [width, height] = label.split("x").map(Number);
                        variants.push({
                            resolution: label,
                            width,
                            height,
                            url,
                        });
                    });

                    variants.sort((a, b) => b.width * b.height - a.width * a.height);

                    if (variants.length > 0) {
                        photos.push({
                            index: photos.length + 1,
                            thumbnail,
                            variants,
                        });
                    }
                }

                /* ───────────── VIDEO ───────────── */
                if (item.find(".icon-dlvideo").length) {
                    const thumbnail = item.find(".download-items__thumb img").attr("src") || '';
                    const videoUrl = item.find('a[title="Download Video"]').attr("href");

                    if (videoUrl) {
                        videos.push({
                            index: videos.length + 1,
                            thumbnail,
                            url: videoUrl,
                            format: "mp4",
                        });
                    }
                }
            });

            if (!photos.length && !videos.length) {
                throw new Error("No media found on Threads URL");
            }

            if (videos.length > 0) {
                const bestVideo = videos[0];
                logger.info(`[ThreadsEngine] Found video: ${bestVideo.url}`);
                const buffer = await this.fetchBuffer(bestVideo.url);
                return {
                    type: 'video',
                    buffer: buffer,
                    urls: [bestVideo.url]
                };
            } else {
                logger.info(`[ThreadsEngine] Found ${photos.length} photos.`);
                const buffers = await Promise.all(photos.map(p => this.fetchBuffer(p.variants[0].url)));
                return {
                    type: 'image',
                    buffers: buffers,
                    urls: photos.map(p => p.variants[0].url)
                };
            }

        } catch (error) {
            logger.error(`[ThreadsEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
