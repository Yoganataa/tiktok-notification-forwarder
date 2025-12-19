// src/constants/index.ts
/**
 * Application-wide constants
 */

export const LIVE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /@(\w+)\s+is\s+live/i,
  /@(\w+)\s+started\s+live/i,
  /@(\w+)\s+went\s+live/i,
  /live.*@(\w+)/i,
  /@(\w+).*live/i,
]);

export const TIKTOK_URL_PATTERN = /tiktok\.com\/@(\w+)/i;

export const REACTION_EMOJIS = Object.freeze({
  CORE_SERVER: '📬',
  EXTERNAL_SERVER: '🌐',
  ERROR: '❌',
} as const);

export const EMBED_COLORS = Object.freeze({
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  INFO: 0x0099ff,
  TIKTOK: 0xff0050,
} as const);

export const DISCORD_LIMITS = Object.freeze({
  EMBED_FIELD_LENGTH: 1024,
  EMBED_DESCRIPTION_LENGTH: 4096,
  EMBED_FIELDS_COUNT: 25,
  EMBED_TOTAL_LENGTH: 6000,
  USERNAME_LENGTH: 50,
} as const);

export const RETRY_DEFAULTS = Object.freeze({
  MAX_ATTEMPTS: 3,
  DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const);

export const DATABASE_DEFAULTS = Object.freeze({
  POOL_TIMEOUT: 10000,
  QUERY_TIMEOUT: 5000,
} as const);

export const APP_VERSION = '2.0.0';

export const LOG_CONFIG = Object.freeze({
  MAX_SIZE: 5 * 1024 * 1024,
  MAX_FILES: 5,
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
} as const);