import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import { logger } from '../../utils/logger';

export default class LinkedInEngine extends BaseDownloadEngine {
    get name(): string {
        return 'linkedin';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[LinkedInEngine] Fetching data for: ${url}`);
            const apiUrl = "https://saywhat.ai/api/fetch-linkedin-page/";

            const response = await axios.post(
                apiUrl,
                { url },
                {
                    headers: {
                        accept: "*/*",
                        "accept-language": "en-US,en;q=0.9",
                        "content-type": "application/json",
                        priority: "u=1, i",
                        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": '"Windows"',
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "sec-gpc": "1",
                        Referer: "https://saywhat.ai/tools/linkedin-video-downloader/",
                    },
                }
            );

            const data = response.data;
            if (!data || !data.data || !data.data.downloadUrl) {
                throw new Error("Invalid response from LinkedIn API (Missing downloadUrl)");
            }

            const videoUrl = data.data.downloadUrl;
            logger.info(`[LinkedInEngine] Found video URL: ${videoUrl}`);

            const buffer = await this.fetchBuffer(videoUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [videoUrl]
            };

        } catch (error) {
            logger.error(`[LinkedInEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
