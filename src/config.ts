// src/config.ts
import dotenv from 'dotenv';

// Load environment variables early
dotenv.config();

/**
 * Application configuration interface
 */
interface Config {
  /** Discord bot token for authentication */
  discordToken: string;
  /** Discord Client ID (Bot ID) */
  clientId: string;
  /** List of Source Bot IDs (Array) */
  sourceBotIds: string[]; 
  /** Owner ID for full system access */
  ownerId: string;
  /** Discord server ID designated as the core/main server */
  coreServerId: string;
  /** Fallback channel ID for unmapped notifications */
  fallbackChannelId: string;
  /** Database connection URL */
  databaseUrl: string;
  /** Winston logging level (error, warn, info, debug) */
  logLevel: string;
  /** Environment mode (development, production) */
  nodeEnv: string;
}

/**
 * Required environment variable names
 */
const REQUIRED_ENV_VARS = Object.freeze([
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'SOURCE_BOT_IDS', 
  'OWNER_ID',
  'CORE_SERVER_ID',
  'FALLBACK_CHANNEL_ID',
  'DATABASE_URL'
] as const);

/**
 * Validates and loads environment configuration
 * * @returns Validated configuration object
 * @throws Error if required variables are missing or invalid
 */
function validateEnv(): Config {
  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  const sourceIds = (process.env.SOURCE_BOT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  const discordIdsToValidate: Record<string, string> = {
    CLIENT_ID: process.env.CLIENT_ID!,
    OWNER_ID: process.env.OWNER_ID!,
    CORE_SERVER_ID: process.env.CORE_SERVER_ID!,
    FALLBACK_CHANNEL_ID: process.env.FALLBACK_CHANNEL_ID!
  };

  for (const [key, value] of Object.entries(discordIdsToValidate)) {
    if (!/^\d+$/.test(value)) {
      throw new Error(
        `Invalid Discord ID for ${key}: "${value}"\n` +
        'Discord IDs must be numeric strings (snowflakes).'
      );
    }
  }

  if (sourceIds.length === 0) {
    throw new Error('SOURCE_BOT_IDS tidak boleh kosong. Masukkan minimal satu ID bot sumber di .env.');
  }
  
  for (const id of sourceIds) {
    if (!/^\d+$/.test(id)) {
      throw new Error(`Invalid Source Bot ID found in list: "${id}". Pastikan hanya angka.`);
    }
  }

  return {
    discordToken: process.env.DISCORD_TOKEN!,
    clientId: process.env.CLIENT_ID!,
    sourceBotIds: sourceIds, 
    ownerId: process.env.OWNER_ID!,
    coreServerId: process.env.CORE_SERVER_ID!,
    fallbackChannelId: process.env.FALLBACK_CHANNEL_ID!,
    databaseUrl: process.env.DATABASE_URL!,
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}

/**
 * Checks if application is running in development mode
 */
export function isDevelopment(config: Config): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Checks if application is running in production mode
 */
export function isProduction(config: Config): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Exported validated configuration object
 * @throws Error if validation fails
 */
export const config = validateEnv();

/**
 * Updates a configuration property at runtime
 * * @param key Configuration property key
 * @param value New value to set
 */
export function updateRuntimeConfig(key: keyof Config, value: any) {
  config[key] = value;
}