import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/download.contract';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../shared/utils/logger';

export default class DevestEngine extends BaseDownloadEngine {
    private client: AxiosInstance;
    private mode: 'hd' | 'non-hd' = 'non-hd';

    get name(): string {
        return 'devest';
    }

    constructor() {
        super();
        this.client = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.tiktok.com/'
            },
            timeout: 30000,
            maxRedirects: 5
        });
    }

    public setMode(mode: string): void {
        this.mode = mode === 'hd' ? 'hd' : 'non-hd';
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            if (this.mode === 'hd') {
                return await this.downloadHD(url);
            } else {
                return await this.downloadNonHD(url);
            }
        } catch (error) {
            logger.error(`[DevestEngine] Failed to download (${this.mode}):`, error);
            throw error;
        }
    }

    private async getRedirectUrl(url: string): Promise<string> {
        try {
            // TikTok short URLs (vm.tiktok.com / vt.tiktok.com) need to be resolved
            if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com') || url.includes('/t/')) {
                // Axios handling of manual redirect check usually throws, but if we allow 3xx:
                // Actually, simpler way in axios is to let it follow redirects and grab responseURL.
                // But for pure link resolution without downloading body:
                try {
                    const finalRes = await this.client.head(url);
                    return finalRes.request.res.responseUrl || url;
                } catch (e) {
                    // Head failed, try GET
                    const response = await this.client.get(url);
                    return response.request.res.responseUrl || url;
                }
            }
            return url;
        } catch (error) {
            return url;
        }
    }

    private async getMediaId(url: string): Promise<string> {
        const finalUrl = await this.getRedirectUrl(url);
        // Regex logic from C# GetMediaID
        const videoMatch = finalUrl.match(/\/video\/(\d+)/);
        if (videoMatch) return videoMatch[1];

        const photoMatch = finalUrl.match(/\/photo\/(\d+)/);
        if (photoMatch) return photoMatch[1];

        throw new Error(`Could not extract Media ID from URL: ${finalUrl}`);
    }

    private async downloadBuffer(url: string): Promise<Buffer> {
        const response = await this.client.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }

    // --- NON-HD DOWNLOADER (Standard Quality) ---
    private async downloadNonHD(url: string): Promise<DownloadResult> {
        const mediaId = await this.getMediaId(url);
        logger.debug(`[Devest:Non-HD] Processing ID: ${mediaId}`);

        // Construct API URL exactly like in C# source
        const apiUrl = `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${mediaId}&iid=7238789370386695942&device_id=7238787983025079814&resolution=1080*2400&channel=googleplay&app_name=musical_ly&version_code=350103&device_platform=android&device_type=Pixel+7&os_version=13`;

        try {
            const dataRes = await this.client.get(apiUrl);
            const data = dataRes.data;

            // Note: The structure might be nested or direct depending on the API version.
            // C# source: data.aweme_list?.find
            const videoObj = data.aweme_list?.find((v: any) => v.aweme_id === mediaId);

            if (!videoObj) throw new Error('Video not found in API response');

            // Try NoWM first, then WM
            let downloadUrl = videoObj.video?.play_addr?.url_list?.[0];
            if (!downloadUrl) {
                downloadUrl = videoObj.video?.download_addr?.url_list?.[0];
            }

            if (!downloadUrl) throw new Error('Download URL not found in JSON');

            logger.debug(`[Devest:Non-HD] Downloading from ${downloadUrl}...`);
            const buffer = await this.downloadBuffer(downloadUrl);

            return {
                type: 'video',
                buffer: buffer,
                urls: [downloadUrl]
            };

        } catch (error: any) {
            logger.error(`[Devest:Non-HD] Error: ${error.message}`);
            throw error;
        }
    }

    // --- HD DOWNLOADER (High Quality) ---
    private async downloadHD(url: string): Promise<DownloadResult> {
        // Media ID extraction might fail if the URL is not standard, fallback to full URL if needed?
        // The C# code uses mediaId specifically.
        const mediaId = await this.getMediaId(url);
        logger.debug(`[Devest:HD] Processing ID: ${mediaId}`);

        // 1. Submit Task
        const submitEndpoint = "https://www.tikwm.com/api/video/task/submit";
        const formParams = new URLSearchParams();
        // API expects 'url' parameter to be the video ID or full URL. Using ID based on source.
        formParams.append('url', `https://www.tiktok.com/@user/video/${mediaId}`);
        formParams.append('web', '1');

        try {
            const submitRes = await this.client.post(submitEndpoint, formParams);
            const submitData = submitRes.data;

            if (submitData.code !== 0 || !submitData.data?.task_id) {
                 // Try fallback with raw URL if ID failed
                 logger.warn(`[Devest:HD] Task submit failed with ID, retrying with raw URL...`);
                 const formParamsRetry = new URLSearchParams();
                 formParamsRetry.append('url', url);
                 formParamsRetry.append('web', '1');

                 const retryRes = await this.client.post(submitEndpoint, formParamsRetry);
                 if (retryRes.data.code !== 0 || !retryRes.data.data?.task_id) {
                     throw new Error(`Failed to submit task: ${JSON.stringify(submitData)}`);
                 }
                 submitData.data = retryRes.data.data;
            }

            const taskId = submitData.data.task_id;
            logger.debug(`[Devest:HD] Task Submitted. Task ID: ${taskId}`);

            // 2. Poll for Result
            let hdVideoUrl = '';
            let attempts = 0;
            const maxRetries = 15;

            while (attempts < maxRetries) {
                await new Promise(r => setTimeout(r, 1000)); // Wait 1 sec
                attempts++;

                const resultRes = await this.client.get(`https://www.tikwm.com/api/video/task/result?task_id=${taskId}`);
                const resultData = resultRes.data;

                if (resultData.code === 0 && resultData.data) {
                    // Check status property? The source code checks resultData.data.status === 2
                    // But typically tikwm returns 'data' directly if done?
                    // Let's stick to source logic:
                    // Source: if (status === 2 && size > 0)

                    // Note: Type definition for resultData might be loose here
                    const status = resultData.data.status;
                    const size = resultData.data.detail?.size;

                    if (status === 2 && size > 0) {
                        // Source: hdVideoUrl = resultData.data.detail.play_url;
                        // TikWM usually returns 'play' (No WM) or 'wmplay' (WM)
                        // 'play_url' in detail object seems correct based on source
                        hdVideoUrl = resultData.data.detail.play_url || resultData.data.play;
                        logger.debug(`[Devest:HD] Task Ready! Size: ${size}`);
                        break;
                    }
                }
                // logger.debug(`[Devest:HD] Waiting for task... (${attempts}/${maxRetries})`);
            }

            if (!hdVideoUrl) throw new Error("HD URL extraction timed out or failed.");

            // Construct full URL if relative
            if (hdVideoUrl.startsWith('/')) {
                hdVideoUrl = `https://www.tikwm.com${hdVideoUrl}`;
            }

            logger.debug(`[Devest:HD] Downloading HD Video from ${hdVideoUrl}...`);
            const buffer = await this.downloadBuffer(hdVideoUrl);

            return {
                type: 'video',
                buffer: buffer,
                urls: [hdVideoUrl]
            };

        } catch (error: any) {
            logger.error(`[Devest:HD] Error: ${error.message}`);
            throw error;
        }
    }
}
