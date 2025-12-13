// src/constants/index.ts
/**
 * Application-wide constants
 */

/**
 * Regex patterns for detecting TikTok live notifications
 * Frozen to prevent modification at runtime
 */
export const LIVE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /@(\w+)\s+is\s+live/i,
  /@(\w+)\s+started\s+live/i,
  /@(\w+)\s+went\s+live/i,
  /live.*@(\w+)/i,
  /@(\w+).*live/i
]);

/**
 * Pattern for extracting username from TikTok URLs
 */
export const TIKTOK_URL_PATTERN = /tiktok\.com\/@(\w+)/i;

/**
 * Emoji reactions for different forwarding scenarios
 */
export const REACTION_EMOJIS = Object.freeze({
  /** Emoji for notifications forwarded within core server */
  CORE_SERVER: '📬',
  /** Emoji for notifications forwarded from external servers */
  EXTERNAL_SERVER: '🌐',
  /** Emoji for failed operations */
  ERROR: '❌'
} as const);

/**
 * Colors for Discord embeds (hexadecimal)
 */
export const EMBED_COLORS = Object.freeze({
  /** Success/confirmation actions */
  SUCCESS: 0x00FF00,
  /** Error/deletion actions */
  ERROR: 0xFF0000,
  /** Information/neutral actions */
  INFO: 0x0099FF,
  /** TikTok brand color */
  TIKTOK: 0xFF0050
} as const);

/**
 * Discord API limitations
 */
export const DISCORD_LIMITS = Object.freeze({
  /** Maximum length for embed field value */
  EMBED_FIELD_LENGTH: 1024,
  /** Maximum length for embed description */
  EMBED_DESCRIPTION_LENGTH: 4096,
  /** Maximum number of embed fields */
  EMBED_FIELDS_COUNT: 25,
  /** Maximum total embed size in characters */
  EMBED_TOTAL_LENGTH: 6000,
  /** Maximum username length */
  USERNAME_LENGTH: 50
} as const);

/**
 * Retry configuration defaults
 */
export const RETRY_DEFAULTS = Object.freeze({
  /** Default maximum retry attempts */
  MAX_ATTEMPTS: 3,
  /** Default initial delay in milliseconds */
  DELAY_MS: 1000,
  /** Default exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2
} as const);

/**
 * Database configuration
 */
export const DATABASE_DEFAULTS = Object.freeze({
  /** Connection pool timeout in milliseconds */
  POOL_TIMEOUT: 10000,
  /** Query timeout in milliseconds */
  QUERY_TIMEOUT: 5000
} as const);

/**
 * Application version (should match package.json)
 */
export const APP_VERSION = '1.0.0';

/**
 * Log rotation configuration
 */
export const LOG_CONFIG = Object.freeze({
  /** Maximum log file size in bytes (5MB) */
  MAX_SIZE: 5 * 1024 * 1024,
  /** Maximum number of log files to keep */
  MAX_FILES: 5,
  /** Log file date format */
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss'
} as const);