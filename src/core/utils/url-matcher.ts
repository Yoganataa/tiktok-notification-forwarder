/**
 * Regex Patterns for detecting platforms from URLs.
 * Order matters (more specific patterns first).
 */
export const PLATFORM_PATTERNS: { [key: string]: RegExp } = {
    // Video / Short Form
    TIKTOK: /(?:https?:\/\/)?(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/i,
    DOUYIN: /(?:https?:\/\/)?(?:www\.|v\.)?douyin\.com\/[^\s]+/i,
    KUAISHOU: /(?:https?:\/\/)?(?:www\.|v\.)?kuaishou\.com\/[^\s]+/i,
    YOUTUBE: /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i,
    CAPCUT: /(?:https?:\/\/)?(?:www\.)?capcut\.com\/[^\s]+/i,
    DAILYMOTION: /(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/[^\s]+/i,

    // Social Media
    TWITTER: /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[^\s]+/i,
    INSTAGRAM: /(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i,
    FACEBOOK: /(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.me)\/[^\s]+/i,
    THREADS: /(?:https?:\/\/)?(?:www\.)?threads\.net\/[^\s]+/i,
    BLUESKY: /(?:https?:\/\/)?(?:www\.)?bsky\.app\/[^\s]+/i,
    LINKEDIN: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s]+/i,
    TUMBLR: /(?:https?:\/\/)?(?:www\.|[a-zA-Z0-9-]+\.)?tumblr\.com\/[^\s]+/i,
    SNAPCHAT: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/[^\s]+/i,
    REDDIT: /(?:https?:\/\/)?(?:www\.|old\.)?(?:reddit\.com|redd\.it)\/[^\s]+/i,
    PINTEREST: /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com|pin\.it)\/[^\s]+/i,

    // Audio / Music
    SOUNDCLOUD: /(?:https?:\/\/)?(?:www\.|m\.)?soundcloud\.com\/[^\s]+/i,
    SPOTIFY: /(?:https?:\/\/)?(?:open\.)?spotify\.com\/[^\s]+/i,

    // Other / Storage
    TERABOX: /(?:https?:\/\/)?(?:www\.)?(?:terabox\.com|teraboxapp\.com)\/[^\s]+/i,
    TWITCH: /(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/[^\s]+/i,
};

/**
 * Extracts the first valid URL from a text string that matches a known platform pattern.
 * @param text The input text (e.g., chat message)
 * @returns The extracted URL or null if no match found.
 */
export function extractUrl(text: string): string | null {
    if (!text) return null;

    // 1. Extract potential URLs first (simple regex)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);

    if (!matches) return null;

    // 2. Validate against platform patterns
    for (const url of matches) {
        for (const pattern of Object.values(PLATFORM_PATTERNS)) {
            if (pattern.test(url)) {
                return url;
            }
        }
    }

    return null;
}

/**
 * Detects the platform of a given URL.
 * @param url The URL to check.
 * @returns The platform key (lowercase) or null.
 */
export function detectPlatform(url: string): string | null {
    if (!url) return null;

    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
        if (pattern.test(url)) {
            return platform.toLowerCase();
        }
    }
    return null;
}
