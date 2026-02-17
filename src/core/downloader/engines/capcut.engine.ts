import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import { logger } from '../../utils/logger';

export default class CapCutEngine extends BaseDownloadEngine {
    get name(): string {
        return 'capcut';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[CapCutEngine] Fetching data for: ${url}`);
            const apiUrl = "https://www.genviral.io/api/tools/social-downloader";

            const response = await axios.post(
                apiUrl,
                { url },
                {
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en-US,en;q=0.5',
                        'baggage': 'sentry-environment=production,sentry-release=102ca3483de9fd3f3fc19cd9c61e8923bdab7852,sentry-public_key=360a5271964ef3bc33b47f8760ecec7d,sentry-trace_id=477e8e97116373a0dca68d1509192b89,sentry-org_id=4509345024901120,sentry-transaction=GET%20%2Ftools%2Fdownload%2F%5Bplatform%5D,sentry-sampled=true,sentry-sample_rand=0.0037737885879629562,sentry-sample_rate=1',
                        'content-type': 'application/json',
                        'dnt': '1',
                        'origin': 'https://www.genviral.io',
                        'priority': 'u=1, i',
                        'referer': 'https://www.genviral.io/tools/download/capcut',
                        'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Brave";v="140"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'sec-gpc': '1',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
                    },
                }
            );

            const data = response.data;
            if (!data || !data.data || !data.data.url) {
                throw new Error("Invalid response from CapCut API");
            }

            const videoUrl = data.data.url;
            logger.info(`[CapCutEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[CapCutEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
