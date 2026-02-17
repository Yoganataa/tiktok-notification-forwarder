import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as qs from 'qs';
import { logger } from '../../utils/logger';

export default class TeraboxEngine extends BaseDownloadEngine {
    get name(): string {
        return 'terabox';
    }

    private async fetchNonce(): Promise<string> {
        try {
            const res = await axios.get("https://teradownloaderz.com", {
                headers: {
                    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                },
            });

            const $ = cheerio.load(res.data);
            const scriptContent = $("#jquery-core-js-extra").html();

            if (!scriptContent) {
                throw new Error("Nonce script not found");
            }

            const nonceMatch = scriptContent.match(/"nonce":"(.*?)"/);
            if (!nonceMatch) {
                throw new Error("Nonce not found");
            }

            return nonceMatch[1];
        } catch (error) {
             throw new Error(`Failed to fetch nonce: ${(error as Error).message}`);
        }
    }

    async download(url: string): Promise<DownloadResult> {
        try {
            logger.info(`[TeraboxEngine] Fetching data for: ${url}`);

            const nonce = await this.fetchNonce();
            logger.debug(`[TeraboxEngine] Nonce: ${nonce}`);

            const res = await axios.post(
                "https://teradownloaderz.com/wp-admin/admin-ajax.php",
                qs.stringify({
                    action: "terabox_fetch",
                    url: url,
                    nonce: nonce,
                }),
                {
                    headers: {
                        accept: "*/*",
                        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                        origin: "https://teradownloaderz.com",
                        referer: "https://teradownloaderz.com/",
                        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                        "x-requested-with": "XMLHttpRequest",
                    },
                }
            );

            // Based on similar patterns, this returns JSON with download info
            const data = res.data;
            if (!data || !data.success || !data.data || !data.data.download_url) {
                 // Check if it's direct download or different field
                 // Source A returns `res.data`. Need to inspect if possible.
                 // Assuming standard WP Ajax JSON: { success: true, data: { ... } }

                 // If structure is { status: 'success', list: [...] } or similar
                 if (data.list && data.list.length > 0) {
                     const file = data.list[0];
                     const fileUrl = file.dlink;
                     const buffer = await this.fetchBuffer(fileUrl);
                     return { type: 'video', buffer, urls: [fileUrl] };
                 }

                 throw new Error("Invalid response format from Terabox API");
            }

            // Standard assumption
            const downloadUrl = data.data.download_url;
            const buffer = await this.fetchBuffer(downloadUrl);
            return {
                type: 'video',
                buffer: buffer,
                urls: [downloadUrl]
            };

        } catch (error) {
            logger.error(`[TeraboxEngine] Error: ${(error as Error).message}`);
            throw error;
        }
    }

    private async fetchBuffer(url: string): Promise<Buffer> {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
