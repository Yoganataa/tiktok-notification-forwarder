import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../shared/utils/logger';
import { parseVideoId, TIKTOK_PATTERNS } from '../../shared/utils/tiktok-validator';

export default class DevestAlphaEngine extends BaseDownloadEngine {
    private client: AxiosInstance;

    get name(): string {
        return 'devest-alpha';
    }

    constructor() {
        super();
        this.client = axios.create({
            headers: {
                'User-Agent': 'com.ss.android.ugc.trill/350103 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230605.012; Cronet/58.0.2991.0)',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            },
            timeout: 30000,
            maxRedirects: 5
        });
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async getRedirectUrl(url: string): Promise<string> {
        try {
            if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com') || url.includes('/t/')) {
                const response = await this.client.head(url, { maxRedirects: 5 });
                return response.request.res.responseUrl || url;
            }
            return url;
        } catch (error) {
            try {
                const response = await this.client.get(url);
                return response.request.res.responseUrl || url;
            } catch {
                return url;
            }
        }
    }

    private async getMediaId(url: string): Promise<string> {
        const finalUrl = await this.getRedirectUrl(url);

        const mediaId = parseVideoId(finalUrl);
        if (mediaId) return mediaId;

        throw new Error(`Could not extract Media ID from URL: ${finalUrl}`);
    }

    private async downloadBuffer(url: string): Promise<Buffer> {
        // Size check (HEAD)
        try {
            const head = await this.client.head(url);
            const contentLength = parseInt(head.headers['content-length'] || '0');
            if (contentLength > 25 * 1024 * 1024) { // 25MB
                throw new Error('File too large');
            }
        } catch (error) {
            if ((error as Error).message === 'File too large') throw error;
            // Ignore other errors (e.g. 405 Method Not Allowed) and proceed to stream check
        }

        // Download with stream to check size dynamically if HEAD failed or wasn't trusted
        const response = await this.client.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        if (buffer.length > 25 * 1024 * 1024) {
            throw new Error('File too large');
        }

        return buffer;
    }

    private async downloadBuffers(urls: string[]): Promise<Buffer[]> {
        // Download all images concurrently
        return Promise.all(urls.map(url => this.downloadBuffer(url)));
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            // Attempt HD first (Auto Mode)
            logger.info('[DevestEngine] Attempting HD download...');
            return await this.downloadHD(url);
        } catch (error) {
            const msg = (error as Error).message;
            if (msg === 'File too large' || msg.includes('timeout') || msg.includes('failed')) {
                logger.warn(`[DevestEngine] HD failed (${msg}), falling back to Non-HD...`);
                return await this.downloadNonHD(url);
            }
            throw error;
        }
    }

    // --- HD DOWNLOADER (High Quality - TikWM) ---
    private async downloadHD(url: string): Promise<DownloadResult> {
        const mediaId = await this.getMediaId(url);
        const hdHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        try {
            // 1. Check Image Post first
            const checkRes = await this.client.get(`https://www.tikwm.com/api/?url=${mediaId}&hd=1`, { headers: hdHeaders });
            const checkData = checkRes.data;

            if (checkData.code === 0 && checkData.data?.images) {
                const images: string[] = checkData.data.images;
                logger.info(`[Devest:HD] Found slideshow with ${images.length} images.`);
                const buffers = await this.downloadBuffers(images);
                return { type: 'image', buffers, urls: images };
            }

            // 2. Submit Task for Video
            const submitEndpoint = "https://www.tikwm.com/api/video/task/submit";
            const formParams = new URLSearchParams();
            formParams.append('url', mediaId);
            formParams.append('web', '1');

            const submitRes = await this.client.post(submitEndpoint, formParams, { headers: hdHeaders });
            const submitData = submitRes.data;

            if (submitData.code !== 0 || !submitData.data?.task_id) {
                // Try fallback with raw URL if ID failed (per previous logic)
                const formParamsRetry = new URLSearchParams();
                formParamsRetry.append('url', url);
                formParamsRetry.append('web', '1');
                const retryRes = await this.client.post(submitEndpoint, formParamsRetry, { headers: hdHeaders });

                if (retryRes.data.code !== 0 || !retryRes.data.data?.task_id) {
                    throw new Error(`Failed to submit HD task: ${JSON.stringify(submitData)}`);
                }
                submitData.data = retryRes.data.data;
            }

            const taskId = submitData.data.task_id;
            let hdVideoUrl = '';
            let attempts = 0;
            const maxRetries = 15;

            while (attempts < maxRetries) {
                await this.delay(1000);
                attempts++;

                const resultRes = await this.client.get(`https://www.tikwm.com/api/video/task/result?task_id=${taskId}`, { headers: hdHeaders });
                const resultData = resultRes.data;

                if (resultData.code === 0 && resultData.data) {
                    const status = resultData.data.status;
                    const size = resultData.data.detail?.size;

                    if (status === 2 && size > 0) {
                        hdVideoUrl = resultData.data.detail.play_url;
                        break;
                    }
                }
            }

            if (!hdVideoUrl) throw new Error("HD URL extraction timed out.");

            if (hdVideoUrl.startsWith('/')) {
                hdVideoUrl = `https://www.tikwm.com${hdVideoUrl}`;
            }

            const buffer = await this.downloadBuffer(hdVideoUrl);
            return { type: 'video', buffer, urls: [hdVideoUrl] };

        } catch (error) {
            throw error;
        }
    }

    // --- NON-HD DOWNLOADER (Standard Quality - Internal API) ---
    private async downloadNonHD(url: string): Promise<DownloadResult> {
        const mediaId = await this.getMediaId(url);
        const apiUrl = `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${mediaId}&iid=7238789370386695942&device_id=7238787983025079814&resolution=1080*2400&channel=googleplay&app_name=musical_ly&version_code=350103&device_platform=android&device_type=Pixel+7&os_version=13`;

        let attempts = 0;
        const maxRetries = 3;

        while (attempts < maxRetries) {
            try {
                attempts++;
                const dataRes = await this.client.get(apiUrl);
                const data = dataRes.data;

                if (!data.aweme_list || data.aweme_list.length === 0) {
                    throw new Error('API returned empty aweme_list. Possible region block or invalid ID.');
                }

                const videoObj = data.aweme_list.find((v: any) => v.aweme_id === mediaId);
                if (!videoObj) throw new Error('Video ID mismatch in API response.');

                // Check for Slideshow
                if (videoObj.image_post_info && videoObj.image_post_info.images) {
                    const images = videoObj.image_post_info.images;
                    const imageUrls: string[] = [];

                    for (const img of images) {
                        const imgUrl = img.display_image.url_list[0];
                        if (imgUrl) imageUrls.push(imgUrl);
                    }

                    const buffers = await this.downloadBuffers(imageUrls);
                    return { type: 'image', buffers, urls: imageUrls };
                }

                // Video Download
                const downloadUrl = videoObj.video?.play_addr?.url_list?.[0] || videoObj.video?.download_addr?.url_list?.[0];
                if (!downloadUrl) throw new Error('Download URL not found in JSON.');

                const buffer = await this.downloadBuffer(downloadUrl);
                return { type: 'video', buffer, urls: [downloadUrl] };

            } catch (error: any) {
                if (error.response && error.response.status === 429) {
                    await this.delay(5000);
                    continue;
                }
                if (attempts >= maxRetries) throw error;
            }
        }
        throw new Error("Download failed after max retries.");
    }
}
