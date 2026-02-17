// src/constants/index.ts
import packageJson from '../../../package.json';

/**
 * Regular expression patterns used to detect TikTok live stream notifications.
 * * Used by the ForwarderService to parse incoming messages and extract usernames
 * from supported bot outputs.
 */
export const LIVE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /@(\w+)\s+is\s+live/i,
  /@(\w+)\s+started\s+live/i,
  /@(\w+)\s+went\s+live/i,
  /live.*@(\w+)/i,
  /@(\w+).*live/i,
]);

/**
 * Regex pattern to validate and extract usernames from standard TikTok URLs.
 * * Matches: `tiktok.com/@username`
 */
export const TIKTOK_URL_PATTERN = /tiktok\.com\/@(\w+)/i;

/**
 * Standard emojis used for visual feedback and status indication in Discord messages.
 */
export const REACTION_EMOJIS = Object.freeze({
  CORE_SERVER: '📬',
  EXTERNAL_SERVER: '🌐',
  ERROR: '❌',
} as const);

/**
 * Hexadecimal color codes for standardizing the visual theme of Discord embeds.
 */
export const EMBED_COLORS = Object.freeze({
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  INFO: 0x0099ff,
  TIKTOK: 0xff0050,
} as const);

/**
 * Official Discord API limits for message content and embeds.
 * * Used strictly to validate content before sending to prevent API 400 Bad Request errors.
 */
export const DISCORD_LIMITS = Object.freeze({
  EMBED_FIELD_LENGTH: 1024,
  EMBED_DESCRIPTION_LENGTH: 4096,
  EMBED_FIELDS_COUNT: 25,
  EMBED_TOTAL_LENGTH: 6000,
  USERNAME_LENGTH: 50,
} as const);

/**
 * Default configuration for the exponential backoff retry mechanism.
 * * Applied when database connections or API calls fail transiently.
 */
export const RETRY_DEFAULTS = Object.freeze({
  MAX_ATTEMPTS: 3,
  DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const);

/**
 * Default timeout settings for database connection pools and queries.
 * * Ensures the application does not hang indefinitely on stalled database operations.
 */
export const DATABASE_DEFAULTS = Object.freeze({
  POOL_TIMEOUT: 10000,
  QUERY_TIMEOUT: 5000,
} as const);

/**
 * Current semantic version of the application.
 * * Pulled dynamically from package.json to ensure consistency across the app.
 */
export const APP_VERSION = packageJson.version;

/**
 * Configuration settings for the file-based logging system.
 * * Defines file rotation policies and timestamp formatting.
 */
export const LOG_CONFIG = Object.freeze({
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES: 5,
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
} as const);