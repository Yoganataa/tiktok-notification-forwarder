export const PLATFORM_PATTERNS = {
    TIKTOK: /tiktok\.com|douyin\.com/i,
    TWITTER: /twitter\.com|x\.com/i,
    REDDIT: /reddit\.com|redd\.it/i,
    INSTAGRAM: /instagram\.com/i,
    FACEBOOK: /facebook\.com|fb\.watch/i,
    YOUTUBE: /youtube\.com|youtu\.be/i,
    LINKEDIN: /linkedin\.com/i,
    PINTEREST: /pinterest\.com|pin\.it/i,
    SNAPCHAT: /snapchat\.com/i,
    SOUNDCLOUD: /soundcloud\.com/i,
    SPOTIFY: /spotify\.com/i,
    TWITCH: /twitch\.tv/i,
    THREADS: /threads\.net/i,
    TUMBLR: /tumblr\.com/i,
    BLUESKY: /bsky\.app/i,
};

export function detectPlatform(url: string): string | null {
    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
        if (pattern.test(url)) {
            return platform.toLowerCase();
        }
    }
    return null;
}
