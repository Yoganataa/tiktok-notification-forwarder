import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import { logger } from '../../utils/logger';

export default class TumblrEngine extends BaseDownloadEngine {
    get name(): string {
        return 'tumblr';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[TumblrEngine] Fetching data for: ${url}`);
            const apiUrl = "https://tumbleclip.com/api/tumblr";

            const res = await axios.post(
                apiUrl,
                { url },
                {
                    headers: {
                        accept: "*/*",
                        "accept-language": "en-US,en;q=0.6",
                        "content-type": "application/json",
                        priority: "u=1, i",
                        "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Brave";v="140"',
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": '"Windows"',
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "sec-gpc": "1",
                        Referer: "https://tumbleclip.com/en",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                    },
                }
            );

            const data = res.data;
            if (!data || !data.data || !data.data.video_url) {
                // Check if it's image or video
                // If video_url exists, it's a video.
                // If it's an image post, Tumbleclip might return 'images' array or similar.
                // Source A assumes `res.data` is returned directly.
                // We'll check for `video_url` as primary target based on "tumbleclip" name.

                if (data.data && data.data.images && Array.isArray(data.data.images)) {
                    const images = data.data.images;
                    const buffers = await Promise.all(images.map((img: string) => this.fetchBuffer(img)));
                    return {
                        type: 'image',
                        buffers: buffers,
                        urls: images
                    };
                }

                if (data.data && data.data.video_url) {
                    const videoUrl = data.data.video_url;
                    const buffer = await this.fetchBuffer(videoUrl);
                    return {
                        type: 'video',
                        buffer: buffer,
                        urls: [videoUrl]
                    };
                }

                throw new Error("Invalid response from Tumblr API (No media found)");
            }

            const videoUrl = data.data.video_url;
            logger.info(`[TumblrEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[TumblrEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
