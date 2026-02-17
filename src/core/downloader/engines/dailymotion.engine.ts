import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import { logger } from '../../utils/logger';

export default class DailymotionEngine extends BaseDownloadEngine {
    get name(): string {
        return 'dailymotion';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[DailymotionEngine] Fetching data for: ${url}`);
            const { data } = await axios.get("https://ssdown.app/api/dailymotion", {
                params: { url: url },
                headers: {
                    accept: "*/*",
                    referer: "https://ssdown.app/dailymotion",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });

            if (!data || !data.data || !data.data.url) {
                throw new Error("Invalid response from Dailymotion API");
            }

            const videoUrl = data.data.url;
            logger.info(`[DailymotionEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[DailymotionEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
