import dotenv from 'dotenv';
import { ValidationError } from '../errors/validation.error';
import { logger, setLogLevel } from '../../shared/utils/logger';
import { SystemConfigRepository } from '../../repositories/system-config.repository';

dotenv.config();

export type DatabaseDriver = 'postgres' | 'sqlite';

/**
 * Interface defining the application's configuration structure.
 */
export interface AppConfig {
  discord: {
    token: string;
    clientId: string;
    ownerId: string;
    coreServerId: string;
    extraGuildIds: string[];
  };
  bot: {
    sourceBotIds: string[];
    fallbackChannelId: string;
    autoCreateCategoryId: string;
    manualDownloadMode: boolean;
  };
  database: {
    driver: DatabaseDriver;
    url: string; // Connection string for PG, or File Path for SQLite
    maxConnections: number;
    minConnections: number;
    ssl: boolean;
  };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    logLevel: string;
  };
  update: {
    upstreamRepo: string;
    upstreamBranch: string;
  };
}

class ConfigManager {
  private config: AppConfig | null = null;

  load(): AppConfig {
    if (this.config) return this.config;

    const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID', 'DATABASE_URL'];
    const missing = requiredVars.filter((key) => !process.env[key]);
    
    if (missing.length > 0) {
      throw new ValidationError(`Missing required env vars: ${missing.join(', ')}`);
    }

    // Determine driver based on ENV or URL prefix
    let driver: DatabaseDriver = 'postgres';
    if (process.env.DB_DRIVER === 'sqlite' || process.env.DATABASE_URL!.startsWith('sqlite')) {
      driver = 'sqlite';
    }

    this.config = {
      discord: {
        token: process.env.DISCORD_TOKEN!,
        clientId: process.env.CLIENT_ID!,
        ownerId: process.env.OWNER_ID!,
        coreServerId: process.env.CORE_SERVER_ID || '',
        extraGuildIds: this.parseList(process.env.EXTRA_GUILD_IDS || ''),
      },
      bot: {
        sourceBotIds: this.parseList(process.env.SOURCE_BOT_IDS || ''),
        fallbackChannelId: process.env.FALLBACK_CHANNEL_ID || '0',
        autoCreateCategoryId: process.env.AUTO_CREATE_CATEGORY_ID || '0',
        manualDownloadMode: process.env.MANUAL_DOWNLOAD_MODE === 'true',
      },
      database: {
        driver: driver,
        url: process.env.DATABASE_URL!,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
        minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
        ssl: process.env.DB_SSL === 'true',
      },
      app: {
        nodeEnv: (process.env.NODE_ENV as any) || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
      },
      update: {
        upstreamRepo: process.env.UPSTREAM_REPO || 'https://github.com/Yoganataa/tiktok-notification-forwarder/',
        upstreamBranch: process.env.UPSTREAM_BRANCH || 'main',
      },
    };

    return this.config;
  }

  async loadFromDatabase(repository: SystemConfigRepository): Promise<void> {
    if (!this.config) this.load();

    try {
      const settings = await repository.findAll();
      
      if (settings.length === 0) {
        logger.info('Database configuration is empty. Using environment variables/defaults.');
        return;
      }

      logger.info('Applying configuration overrides from database...');
      let updatesCount = 0;

      for (const setting of settings) {
        const { key, value } = setting;
        switch (key) {
          case 'SOURCE_BOT_IDS': 
            this.config!.bot.sourceBotIds = this.parseList(value); 
            updatesCount++; 
            break;
          case 'FALLBACK_CHANNEL_ID': 
            this.config!.bot.fallbackChannelId = value; 
            updatesCount++; 
            break;
          case 'AUTO_CREATE_CATEGORY_ID':
            this.config!.bot.autoCreateCategoryId = value;
            updatesCount++;
            break;
          case 'CORE_SERVER_ID': 
            this.config!.discord.coreServerId = value; 
            updatesCount++; 
            break;
          case 'EXTRA_GUILD_IDS':
            this.config!.discord.extraGuildIds = this.parseList(value);
            updatesCount++;
            break;
          case 'MANUAL_DOWNLOAD_MODE':
            this.config!.bot.manualDownloadMode = value === 'true';
            updatesCount++;
            break;
          case 'DB_MAX_CONNECTIONS': 
            this.config!.database.maxConnections = parseInt(value); 
            updatesCount++; 
            break;
          case 'DB_MIN_CONNECTIONS': 
            this.config!.database.minConnections = parseInt(value); 
            updatesCount++; 
            break;
        }
      }

      if (updatesCount > 0) {
        logger.info(`Dynamic configuration: ${updatesCount} values overridden successfully.`);
        // Update logger level if it changed
        if (this.config!.app.logLevel) {
            setLogLevel(this.config!.app.logLevel);
        }
      }
    } catch (error) {
      logger.error('Critical: Failed to load dynamic config from database', { 
        error: (error as Error).message 
      });
    }
  }

  get(): AppConfig {
    if (!this.config) throw new Error('Configuration not initialized.');
    return this.config;
  }

  get isConfigured(): boolean {
    return !!(this.config && this.config.discord.coreServerId);
  }

  private parseList(value: string): string[] {
    return value.split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id));
  }
}

export const configManager = new ConfigManager();
