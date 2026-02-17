import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import { logger } from '../../utils/logger';

export default class SnapchatEngine extends BaseDownloadEngine {
    get name(): string {
        return 'snapchat';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[SnapchatEngine] Fetching data for: ${url}`);
            const apiUrl = "https://solyptube.com/findsnapchatvideo";

            const response = await axios.post(
                apiUrl,
                { url },
                {
                    headers: {
                        "accept": "*/*",
                        "accept-language": "en-US,en;q=0.6",
                        "content-type": "application/json",
                        "dnt": "1",
                        "origin": "https://spotlight.how2shout.com",
                        "priority": "u=1, i",
                        "referer": "https://spotlight.how2shout.com/",
                        "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Brave";v="140"',
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": '"Windows"',
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "sec-gpc": "1",
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                    },
                    maxBodyLength: Infinity,
                }
            );

            const data = response.data;
            if (!data || !data.data || !data.data.video) {
                throw new Error("Invalid response from Snapchat API (Missing video URL)");
            }

            const videoUrl = data.data.video;
            logger.info(`[SnapchatEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[SnapchatEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
