// src/core/config/config.ts
import dotenv from 'dotenv';
import { ValidationError } from '../../shared/errors/validation.error';
import { logger } from '../logger';
import { SystemConfigRepository } from '../../modules/admin/infra/system-config.repository';
import { withTransaction } from '../database/transaction';

dotenv.config();

export type DatabaseDriver = 'postgres' | 'sqlite';
export type DownloaderEngine = 'btch' | 'tobyg74' | 'liber' | 'tikwm' | 'douyin' | 'musicaldown' | 'tiktokv2';

export interface AppConfig {
  discord: {
    token: string;
    clientId: string;
    ownerId: string;
    coreServerId: string;
    autoCreateCategoryId: string;
  };
  bot: {
    sourceBotIds: string[];
    fallbackChannelId: string;
    enableDownloader: boolean;
    downloaderEngine: DownloaderEngine;
    tiktokCookie: string;
  };
  database: {
    driver: DatabaseDriver;
    url: string; 
    maxConnections: number;
    minConnections: number;
    ssl: boolean;
  };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    logLevel: string;
  };
}

export class ConfigManager {
  private config: AppConfig | null = null;

  load(): AppConfig {
    if (this.config) return this.config;

    const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID', 'DATABASE_URL'];
    const missing = requiredVars.filter((key) => !process.env[key]);
    
    if (missing.length > 0) {
      throw new ValidationError(`Missing required env vars: ${missing.join(', ')}`);
    }

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
        autoCreateCategoryId: process.env.AUTO_CREATE_CATEGORY_ID || '',
      },
      bot: {
        sourceBotIds: this.parseList(process.env.SOURCE_BOT_IDS || ''),
        fallbackChannelId: process.env.FALLBACK_CHANNEL_ID || '0',
        enableDownloader: process.env.TT_DL === 'true', 
        downloaderEngine: (process.env.DOWNLOADER_ENGINE as DownloaderEngine) || 'btch',
        tiktokCookie: process.env.TIKTOK_COOKIE || '',
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
    };

    return this.config;
  }

  async loadFromDatabase(repository: SystemConfigRepository): Promise<void> {
    if (!this.config) this.load();

    try {
      const settings = await repository.findAll();
      const isInitialState = settings.length <= 2;
      
      if (isInitialState) {
        logger.info('Database configuration is empty. Initializing Auto-Seed...');
        await this.seedDatabase(repository);
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
          case 'CORE_SERVER_ID': 
            this.config!.discord.coreServerId = value; 
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
          case 'TT_DL': 
            this.config!.bot.enableDownloader = value === 'true';
            updatesCount++;
            break;
          case 'DOWNLOADER_ENGINE':
            const validEngines = ['btch', 'tobyg74', 'liber', 'tikwm', 'douyin', 'musicaldown', 'tiktokv2'];
            if (validEngines.includes(value)) {
                this.config!.bot.downloaderEngine = value as DownloaderEngine;
                updatesCount++;
            }
            break;
          case 'TIKTOK_COOKIE':
            this.config!.bot.tiktokCookie = value;
            updatesCount++;
            break;
        }
      }

      if (updatesCount > 0) {
        logger.info(`Dynamic configuration: ${updatesCount} values overridden successfully.`);
      }
    } catch (error) {
      logger.error('Critical: Failed to load dynamic config from database', { 
        error: (error as Error).message 
      });
    }
  }

  private async seedDatabase(repository: SystemConfigRepository): Promise<void> {
    const config = this.config!;
    const seedData = {
      'SOURCE_BOT_IDS': config.bot.sourceBotIds.join(','),
      'FALLBACK_CHANNEL_ID': config.bot.fallbackChannelId,
      'CORE_SERVER_ID': config.discord.coreServerId,
      'DB_MAX_CONNECTIONS': config.database.maxConnections.toString(),
      'DB_MIN_CONNECTIONS': config.database.minConnections.toString(),
      'TT_DL': config.bot.enableDownloader ? 'true' : 'false',
      'DOWNLOADER_ENGINE': config.bot.downloaderEngine,
      'TIKTOK_COOKIE': config.bot.tiktokCookie 
    };

    try {
      await withTransaction(async (tx) => {
          for (const [key, value] of Object.entries(seedData)) {
            await repository.set(key, value, tx);
          }
      });
      logger.info('Auto-Seed: Database successfully synchronized with environment variables.');
    } catch (error) {
      logger.error('Auto-Seed failed', { error: (error as Error).message });
    }
  }

  get(): AppConfig {
    if (!this.config) throw new Error('Configuration not initialized.');
    return this.config;
  }

  private parseList(value: string): string[] {
    return value.split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id));
  }
}

export const configManager = new ConfigManager();