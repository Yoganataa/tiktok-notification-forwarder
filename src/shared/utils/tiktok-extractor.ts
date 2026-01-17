import { Message } from 'discord.js';

/**
 * Compiled Regex for TikTok URLs.
 * Matches standard tiktok.com, vm.tiktok.com, vt.tiktok.com and www.tiktok.com
 * Pattern explanation:
 * https?:\/\/ - http or https
 * (www\.|vm\.|vt\.)? - optional subdomain (www, vm, vt)
 * tiktok\.com\/ - domain
 * [@\w\.\/]+ - path (username, video id, etc)
 */
const TIKTOK_REGEX = /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/[@\w\.\/]+/g;

/**
 * Helper function to extract TikTok links from various message parts.
 * Checks Content, Embeds, and Components (Buttons).
 *
 * Optimized for CPU:
 * 1. Fast string check before regex
 * 2. Reuses compiled regex
 * 3. Uses Set for O(1) deduplication
 */
export function extractTikTokLink(message: Message): string[] {
    // 1. Fast Early Exit: If no part of the message contains "tiktok.com", skip completely.
    // We check content and embeds first as they are most likely to contain it.
    // Note: We do a rough check. If "tiktok.com" isn't in content, it might be in embeds.
    // So we check them one by one or concatenated if we really wanted to be extreme,
    // but individual checks are safer and cleaner.

    const foundUrls: Set<string> = new Set();
    const hasTikTok = (text: string | null | undefined) => text && text.includes('tiktok.com');

    // 1. Check Content
    if (hasTikTok(message.content)) {
        const matches = message.content.match(TIKTOK_REGEX);
        if (matches) matches.forEach(url => foundUrls.add(url));
    }

    // 2. Check Embeds (Description, URL)
    if (message.embeds?.length > 0) {
        for (const embed of message.embeds) {
            // Check Description
            if (hasTikTok(embed.description)) {
                const matches = embed.description!.match(TIKTOK_REGEX);
                if (matches) matches.forEach(url => foundUrls.add(url));
            }
            // Check URL field
            if (hasTikTok(embed.url)) {
                 const matches = embed.url!.match(TIKTOK_REGEX);
                 if (matches) matches.forEach(url => foundUrls.add(url));
            }
        }
    }

    // 3. Check Components (Buttons with URL)
    if (message.components?.length > 0) {
        for (const row of message.components) {
            // Type assertion to access components
            const components = (row as any).components;
            if (components && Array.isArray(components)) {
                for (const component of components) {
                    if (component.url && hasTikTok(component.url)) {
                        const matches = component.url.match(TIKTOK_REGEX);
                        if (matches) matches.forEach((url: string) => foundUrls.add(url));
                    }
                }
            }
        }
    }

    return Array.from(foundUrls);
}
