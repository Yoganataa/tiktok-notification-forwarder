import {BaseProvider, ExtractedInfo} from './base';
import {getFetch} from '../fetch';
import {matchTikTokData} from './utils';
import z from 'zod';

/**
 * @class NativeProvider
 */
export class NativeProvider extends BaseProvider {
    /**
     * Get resource name.
     * @return {string}
     */
    public resourceName(): string {
        return 'native';
    }

    public maintenance = undefined;
    public client = undefined;

    /**
     * @param {string} url Tiktok video url
     * @param {Record<string, string>} params Advanced options.
     * @return {Promise<ExtractedInfo>}
     */
    async fetch(
        url: string,
        params: Record<string, string> = {},
    ): Promise<ExtractedInfo> {
        const urlInstance = new URL(url);
        // Fix: Use default user-agent if not provided to avoid 403/Bad Request
        const userAgent = params['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

        const response = await getFetch(urlInstance.origin).get(
            `.${urlInstance.pathname}`,
            {
                headers: {
                    Referer: urlInstance.href,
                    Origin: urlInstance.origin,
                    'User-Agent': userAgent,
                },
                timeout: {
                    socket: 10000,
                },
            },
        );

        return this.extract(response.body);
    }

    /**
     * @param {string} html Raw HTML Data
     * @return {ExtractedInfo}
     */
    extract(html: string): ExtractedInfo {
        const matches = matchTikTokData(html);
        if (matches.length) {
            const json = Object.values(
                JSON.parse(matches).ItemModule,
            )[0] as any;

            return {
                video: {
                    id: json.id,
                    urls: [json.video.playAddr, json.video.downloadAddr],
                    thumb: json.video.cover,
                    duration: json.video.duration,
                },
                music: {
                    url: json.music.playUrl,
                    title: json.music.title,
                    author: json.music.authorName,
                    id: json.music.id,
                    cover: json.music.coverLarge,
                    album: json.music.album,
                    duration: json.music.duration,
                },
                author: {
                    username: json.author,
                    id: json.authorId,
                    thumb: json.avatarThumb,
                    nick: json.nickname,
                },
                caption: json.desc,
                playsCount: json.stats.playCount,
                sharesCount: json.stats.shareCount,
                commentsCount: json.stats.commentCount,
                likesCount: json.stats.diggCount,
                uploadedAt: json.createTime,
            };
        } else {
            return {
                error: 'Something was wrong!',
            };
        }
    }

    /**
     * Return zod object for validation
     * @return {z.ZodObject}
     */
    public getParams(): z.ZodObject {
        return z.object({
            'user-agent': z.string().min(5),
        });
    }
}
