// src/services/engines/vette-lib/validator.ts

export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Support various TikTok URL formats
  const tiktokUrlPatterns = [
    /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /^(https?:\/\/)?(www\.)?tiktok\.com\/[\w.-]+\/video\/\d+/,
    /^(https?:\/\/)?vm\.tiktok\.com\/[\w\d]+/,
    /^(https?:\/\/)?vt\.tiktok\.com\/[\w\d]+/,
    /^(https?:\/\/)?m\.tiktok\.com\/v\/\d+/,
    /^(https?:\/\/)?(www\.)?tiktok\.com\/t\/[\w\d]+/,
    // Photo/Slide support
    /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/photo\/\d+/,
    /^(https?:\/\/)?(www\.)?tiktok\.com\/[\w.-]+\/photo\/\d+/,
  ]

  return tiktokUrlPatterns.some((pattern) => pattern.test(url.trim()))
}

export function parseVideoId(url: string): string | null {
  const patterns = [
    /\/video\/(\d+)/,
    /\/v\/(\d+)/,
    /\/photo\/(\d+)/,
    /vm\.tiktok\.com\/([\w\d]+)/,
    /vt\.tiktok\.com\/([\w\d]+)/,
    /\/t\/([\w\d]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

// Regex to find a URL in a larger text blob
const URL_EXTRACTION_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Extracts the first valid TikTok URL from a text string.
 * Validates candidates against known TikTok patterns.
 */
export function extractTikTokUrl(text: string): string | null {
    if (!text) return null;

    const matches = text.match(URL_EXTRACTION_REGEX);
    if (!matches) return null;

    for (const candidate of matches) {
        if (validateUrl(candidate)) {
            return candidate;
        }
    }

    return null;
}
