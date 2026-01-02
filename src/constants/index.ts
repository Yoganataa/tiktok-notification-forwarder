// src/constants/index.ts
import fs from 'fs';
import path from 'path';

// Dynamically read package.json at runtime to avoid TypeScript 'rootDir' compilation errors.
const packageJsonPath = path.resolve(process.cwd(), 'package.json');
let packageVersion = '0.0.0';

try {
  const fileContent = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(fileContent);
  packageVersion = pkg.version;
} catch (error) {
  console.error('Failed to read package.json version:', error);
}

/**
 * Regular expression patterns used to detect TikTok live stream notifications.
 */
export const LIVE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /@([\w\.]+)\s+is\s+live/i,      // Update: support dot in username
  /@([\w\.]+)\s+started\s+live/i, // Update: support dot in username
  /@([\w\.]+)\s+went\s+live/i,    // Update: support dot in username
  /live.*@([\w\.]+)/i,            // Update: support dot in username
  /@([\w\.]+).*live/i,            // Update: support dot in username
]);

/**
 * Regex pattern to validate and extract usernames from standard TikTok URLs.
 * * Matches: `tiktok.com/@username`
 * * Update: Now supports dots inside usernames (e.g. @user.name)
 */
export const TIKTOK_URL_PATTERN = /tiktok\.com\/@([\w\.]+)/i;

/**
 * Standard emojis used for visual feedback.
 */
export const REACTION_EMOJIS = Object.freeze({
  CORE_SERVER: '📬',
  EXTERNAL_SERVER: '🌐',
  ERROR: '❌',
} as const);

/**
 * Hexadecimal color codes.
 */
export const EMBED_COLORS = Object.freeze({
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  INFO: 0x0099ff,
  TIKTOK: 0xff0050,
} as const);

/**
 * Official Discord API limits.
 */
export const DISCORD_LIMITS = Object.freeze({
  EMBED_FIELD_LENGTH: 1024,
  EMBED_DESCRIPTION_LENGTH: 4096,
  EMBED_FIELDS_COUNT: 25,
  EMBED_TOTAL_LENGTH: 6000,
  USERNAME_LENGTH: 50,
} as const);

/**
 * Default configuration for retry mechanism.
 */
export const RETRY_DEFAULTS = Object.freeze({
  MAX_ATTEMPTS: 3,
  DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const);

/**
 * Default timeout settings for database.
 */
export const DATABASE_DEFAULTS = Object.freeze({
  POOL_TIMEOUT: 10000,
  QUERY_TIMEOUT: 5000,
} as const);

/**
 * Current semantic version of the application.
 */
export const APP_VERSION = packageVersion;

/**
 * Configuration settings for logs.
 */
export const LOG_CONFIG = Object.freeze({
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES: 5,
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
} as const);