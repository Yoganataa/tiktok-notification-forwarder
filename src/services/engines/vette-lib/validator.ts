// src/services/engines/vette-lib/validator.ts

/**
 * Universal Regex Patterns for TikTok Media ID Extraction.
 * Priority Ordered: Video -> Photo -> Mobile -> Shortened -> Generic Fallback.
 */
const TIKTOK_PATTERNS = [
  /\/video\/(\d+)/,                 // 1. Standard Web
  /\/photo\/(\d+)/,                 // 2. Photo Mode
  /\/v\/(\d+)/,                     // 3. Mobile/Raw
  /\/t\/(\d+)/,                     // 4. Shortened redirect target
  /\/(\d{19,})(?:[^\d]|$)/          // 5. Generic 19+ digit ID (End of string or followed by non-digit)
];

const SHORT_URL_PATTERNS = [
  /vm\.tiktok\.com/,
  /vt\.tiktok\.com/,
  /tiktok\.com\/t\//
];

export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();

  // 1. Check for Short URL patterns (valid format, even if ID not extractable yet)
  if (SHORT_URL_PATTERNS.some(p => p.test(trimmed))) {
    return true;
  }

  // 2. Check for Universal ID patterns
  if (TIKTOK_PATTERNS.some(p => p.test(trimmed))) {
    return true;
  }

  // 3. Basic Domain Check as a catch-all fallback
  return /tiktok\.com/.test(trimmed);
}

export function parseVideoId(url: string): string | null {
  const trimmed = url.trim();

  for (const pattern of TIKTOK_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
