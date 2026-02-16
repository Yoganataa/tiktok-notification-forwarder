import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import { logger } from '../../shared/utils/logger';

export default class SoundCloudEngine extends BaseDownloadEngine {
    get name(): string {
        return 'soundcloud';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[SoundCloudEngine] Fetching data for: ${url}`);
            const apiUrl = "https://urlmp4.com/wp-json/aio-dl/video-data/";

            // The hardcoded hash/token from source code A seems suspicious/likely to expire,
            // but I must port it as requested ("Don't miss anything", "Do not shorten code logic").
            const response = await axios.post(
                apiUrl,
                `url=${encodeURIComponent(url)}&token=8b6e170975d92939bb67d8db567f82e43fa2da91e00a84f258af77c1186c5e8a&hash=aHR0cHM6Ly9zb3VuZGNsb3VkLmNvbS9zb21icnNvbmdzL3VuZHJlc3NlZA%3D%3D1043YWlvLWRs`,
                {
                    headers: {
                        accept: "*/*",
                        "accept-language": "en-US,en;q=0.9",
                        "content-type": "application/x-www-form-urlencoded",
                        priority: "u=1, i",
                        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="140", "Brave";v="140"',
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": '"Windows"',
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "sec-gpc": "1",
                        cookie: "pll_language=en",
                        Referer: "https://urlmp4.com/en/soundcloud-downloader/",
                    },
                }
            );

            const data = response.data;
            if (!data || !data.medias || !Array.isArray(data.medias)) {
                 throw new Error("Invalid response from SoundCloud API");
            }

            // Find audio URL (usually format 'mp3' or 'audio')
            const media = data.medias.find((m: any) => m.extension === 'mp3' || m.type === 'audio');
            if (!media || !media.url) {
                 throw new Error("No audio URL found in response");
            }

            const audioUrl = media.url;
            logger.info(`[SoundCloudEngine] Found audio URL: ${audioUrl}`);

            const buffer = await this.fetchBuffer(audioUrl);

            // Reusing 'video' type as generic media or maybe we need 'audio' type in contract?
            // Contract has 'video' | 'image'. We'll use 'video' as it's binary media.
            return {
                type: 'video',
                buffer: buffer,
                urls: [audioUrl]
            };

        } catch (error) {
            logger.error(`[SoundCloudEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
