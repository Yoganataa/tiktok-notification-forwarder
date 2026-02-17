import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import { logger } from '../../utils/logger';

export default class KuaishouEngine extends BaseDownloadEngine {
    get name(): string {
        return 'kuaishou';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[KuaishouEngine] Fetching data for: ${url}`);

            const response = await axios.post(
                "https://kuaishouvideodownloader.net/api/fetch-video-info",
                { videoUrl: url },
                {
                    headers: {
                        accept: "*/*",
                        "accept-language": "en-US,en;q=0.8",
                        "content-type": "application/json",
                        priority: "u=1, i",
                        "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Brave";v="140"',
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": '"Windows"',
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "sec-gpc": "1",
                        Referer: "https://kuaishouvideodownloader.net/",
                    },
                }
            );

            const data = response.data;
            if (!data || !data.data || !data.data.videoUrl) {
                 throw new Error("Invalid response from Kuaishou API");
            }

            const videoUrl = data.data.videoUrl;
            logger.info(`[KuaishouEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[KuaishouEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
