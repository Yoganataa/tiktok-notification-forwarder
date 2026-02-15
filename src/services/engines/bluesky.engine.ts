import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../shared/utils/logger';

export default class BlueskyEngine extends BaseDownloadEngine {
    get name(): string {
        return 'bluesky';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[BlueskyEngine] Fetching data for: ${url}`);
            const apiUrl = "https://bskysaver.com/download?url=" + encodeURIComponent(url);

            const { data: html } = await axios.get(apiUrl, {
                headers: {
                    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                    referer: "https://bskysaver.com/",
                },
            });

            const $ = cheerio.load(html);
            const section = $("section.download_result_section");

            const photos: { index: number; thumbnail: string; variants: any[] }[] = [];
            const videos: { index: number; thumbnail: string | null; url: string; format: string }[] = [];

            /* ───────────── MEDIA ───────────── */
            section.find(".download_item").each((_, el) => {
                const item = $(el);

                /* IMAGE */
                if (item.find(".image_wrapper img").length) {
                    const img = item.find(".image_wrapper img").first();
                    const dlUrl = item.find("a.download__item__info__actions__button").attr("href");

                    if (dlUrl) {
                        photos.push({
                            index: photos.length + 1,
                            thumbnail: img.attr("src") || '',
                            variants: [
                                {
                                    resolution: "best",
                                    url: dlUrl,
                                },
                            ],
                        });
                    }
                }

                /* VIDEO */
                if (item.find(".video_wrapper video").length) {
                    const video = item.find(".video_wrapper video").first();
                    const dlUrl = video.attr("src");
                    if (dlUrl) {
                        videos.push({
                            index: videos.length + 1,
                            thumbnail: video.attr("poster") || null,
                            url: dlUrl,
                            format: "mp4",
                        });
                    }
                }
            });

            if (!photos.length && !videos.length) {
                throw new Error("No media found on Bluesky URL");
            }

            if (videos.length > 0) {
                 const bestVideo = videos[0];
                 const buffer = await this.fetchBuffer(bestVideo.url);
                 return {
                     type: 'video',
                     buffer: buffer,
                     urls: [bestVideo.url]
                 };
            } else {
                 const buffers = await Promise.all(photos.map(p => this.fetchBuffer(p.variants[0].url)));
                 return {
                     type: 'image',
                     buffers: buffers,
                     urls: photos.map(p => p.variants[0].url)
                 };
            }

        } catch (error) {
            logger.error(`[BlueskyEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
