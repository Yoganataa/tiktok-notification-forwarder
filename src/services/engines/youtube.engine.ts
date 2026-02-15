import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios from 'axios';
import { logger } from '../../shared/utils/logger';

const FORMATS = ["1080p", "720p", "480p", "240p", "144p", "audio"];

export default class YouTubeEngine extends BaseDownloadEngine {
    get name(): string {
        return 'youtube'; // Note: Source B already has YtDlpEngine ('ytdlp'). This is the Source A specific one.
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[YouTubeEngine] Fetching data for: ${url}`);

            const headers = {
                accept: "*/*",
                "content-type": "application/json",
                referer: "https://thesocialcat.com/tools/youtube-video-downloader",
                origin: "https://thesocialcat.com",
                "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            };

            const formatResults: { [key: string]: string } = {};

            // Fetch all formats in parallel (Source A logic)
            await Promise.all(
                FORMATS.map(async (format) => {
                    try {
                        const res = await axios.post(
                            "https://thesocialcat.com/api/youtube-download",
                            { url, format },
                            { headers }
                        );

                        const data = res.data;

                        // Only store if mediaUrl exists and avoid duplicating 720p fallback
                        if (data?.mediaUrl) {
                            if (!(format === "720p" && formatResults["720p"])) {
                                formatResults[format] = data.mediaUrl;
                            }
                        }
                    } catch (err) {
                        // ignore if a format is not available
                        logger.warn(`[YouTubeEngine] Format ${format} not available: ${(err as Error).message}`);
                    }
                })
            );

            if (!Object.keys(formatResults).length) {
                throw new Error("No available formats found for this video");
            }

            // Prefer highest quality video
            const bestFormat = FORMATS.find(f => formatResults[f] && f !== 'audio');

            if (bestFormat) {
                 const videoUrl = formatResults[bestFormat];
                 logger.info(`[YouTubeEngine] Found video: ${bestFormat} -> ${videoUrl}`);
                 const buffer = await this.fetchBuffer(videoUrl);
                 return {
                     type: 'video',
                     buffer: buffer,
                     urls: [videoUrl]
                 };
            }

            // Fallback to audio if only audio available
            if (formatResults['audio']) {
                 const audioUrl = formatResults['audio'];
                 logger.info(`[YouTubeEngine] Found audio: ${audioUrl}`);
                 const buffer = await this.fetchBuffer(audioUrl);
                 return {
                     type: 'video', // Using 'video' type for audio as standardized
                     buffer: buffer,
                     urls: [audioUrl]
                 };
            }

            throw new Error("No suitable media format found");

        } catch (error) {
            logger.error(`[YouTubeEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
