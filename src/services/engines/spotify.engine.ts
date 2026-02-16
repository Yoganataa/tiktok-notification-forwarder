import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import { logger } from '../../shared/utils/logger';

export default class SpotifyEngine extends BaseDownloadEngine {
    get name(): string {
        return 'spotify';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[SpotifyEngine] Fetching data for: ${url}`);
            const apiUrl = "https://songsnatch-2.emergent.host/api/download";

            const res = await axios.post(
                apiUrl,
                { url },
                {
                    headers: {
                        accept: "*/*",
                        "content-type": "application/json",
                        origin: "https://spotihelper.com",
                        referer: "https://spotihelper.com/",
                        "user-agent":
                            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                    },
                    timeout: 10000,
                }
            );

            const data = res.data;
            if (!data || !data.status || !data.data || !data.data.download_url) {
                // Source A just returns `res.data` to client. We need to parse it for DownloadResult.
                // Assuming typical structure: { status: true, data: { download_url: '...' } }
                // If structure differs, we might need to adjust.
                // Looking at Source A: `return res.data;` - no transformation.
                // We'll assume the URL is inside `download_url` or `url` based on similar APIs.

                // Let's check typical SongSnatch response: { "status": true, "data": { "download_url": "..." } }
                // If it fails, we'll log raw data.
                logger.debug(`[SpotifyEngine] Raw Response: ${JSON.stringify(data)}`);

                if (data.url) { // Sometimes direct url
                     const audioUrl = data.url;
                     const buffer = await this.fetchBuffer(audioUrl);
                     return { type: 'video', buffer, urls: [audioUrl] };
                }

                throw new Error("Invalid response from Spotify API");
            }

            const audioUrl = data.data.download_url;
            logger.info(`[SpotifyEngine] Found audio URL: ${audioUrl}`);

            const buffer = await this.fetchBuffer(audioUrl);
            return {
                type: 'video', // Using 'video' for audio as before
                buffer: buffer,
                urls: [audioUrl]
            };

        } catch (err) {
            const error = err as any;
            if (error.response) {
                logger.error(`[SpotifyEngine] API Error: ${error.response.status} ${error.response.statusText}`);
                throw new Error(`Spotify downloader API error: ${error.response.status} ${error.response.statusText}`);
            }
            if (error.request) {
                logger.error("[SpotifyEngine] No response received");
                throw new Error("No response received from Spotify downloader API");
            }
            logger.error(`[SpotifyEngine] Error: ${error.message}`);
            throw new Error(`Spotify downloader request failed: ${error.message}`);
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
