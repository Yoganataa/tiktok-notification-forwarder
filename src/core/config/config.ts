// src/core/config/config.ts
import dotenv from 'dotenv';
import { ValidationError } from '../errors/validation.error';
import { logger } from '../../utils/logger';

dotenv.config();

export interface AppConfig {
  discord: {
    token: string;
    clientId: string;
    ownerId: string;
    coreServerId: string;
  };
  bot: {
    sourceBotIds: string[];
    fallbackChannelId: string;
  };
  database: {
    url: string;
    maxConnections: number;
    minConnections: number;
  };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    logLevel: string;
  };
}

class ConfigManager {
  private config: AppConfig | null = null;

  /**
   * Load and validate configuration
   */
  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    const requiredVars = [
      'DISCORD_TOKEN',
      'CLIENT_ID',
      'OWNER_ID',
      'CORE_SERVER_ID',
      'DATABASE_URL',
    ];

    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }

    const sourceBotIds = this.parseSourceBotIds(
      process.env.SOURCE_BOT_IDS || ''
    );

    this.config = {
      discord: {
        token: process.env.DISCORD_TOKEN!,
        clientId: process.env.CLIENT_ID!,
        ownerId: process.env.OWNER_ID!,
        coreServerId: process.env.CORE_SERVER_ID!,
      },
      bot: {
        sourceBotIds,
        fallbackChannelId: process.env.FALLBACK_CHANNEL_ID || '0',
      },
      database: {
        url: process.env.DATABASE_URL!,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
        minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
      },
      app: {
        nodeEnv: (process.env.NODE_ENV as any) || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
      },
    };

    logger.info('Configuration loaded successfully');
    return this.config;
  }

  /**
   * Get loaded configuration
   */
  get(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Parse comma-separated source bot IDs
   */
  private parseSourceBotIds(value: string): string[] {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id));
  }
}

export const configManager = new ConfigManager();
