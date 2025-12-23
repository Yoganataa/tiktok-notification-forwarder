// src/core/config/config.ts
import dotenv from 'dotenv';
import { ValidationError } from '../errors/validation.error';
import { logger } from '../../utils/logger';
import { SystemConfigRepository } from '../../repositories/system-config.repository';

dotenv.config();

/**
 * Interface defining the application's configuration structure.
 * * Categorizes settings into Discord, Bot, Database, and Application specific scopes.
 */
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
    ssl: boolean;
  };
  app: {
    nodeEnv: 'development' | 'production' | 'test';
    logLevel: string;
  };
}

/**
 * Manager class for handling application configuration from multiple sources.
 * * Loads initial values from environment variables (`.env`).
 * * Hydrates and overrides configuration with dynamic values stored in the database.
 * * Handles auto-seeding of the database with environment defaults on a fresh install.
 */
class ConfigManager {
  private config: AppConfig | null = null;

  /**
   * Loads the base configuration from system environment variables.
   * * Validates the presence of critical keys (`DISCORD_TOKEN`, `CLIENT_ID`, etc.).
   * * @throws {ValidationError} If required environment variables are missing.
   * * @returns The initial configuration object populated from `.env`.
   */
  load(): AppConfig {
    if (this.config) return this.config;

    const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID', 'DATABASE_URL'];
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required env vars: ${missing.join(', ')}`);
    }

    this.config = {
      discord: {
        token: process.env.DISCORD_TOKEN!,
        clientId: process.env.CLIENT_ID!,
        ownerId: process.env.OWNER_ID!,
        coreServerId: process.env.CORE_SERVER_ID || '',
      },
      bot: {
        sourceBotIds: this.parseList(process.env.SOURCE_BOT_IDS || ''),
        fallbackChannelId: process.env.FALLBACK_CHANNEL_ID || '0',
      },
      database: {
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

  /**
   * Fetches dynamic configuration overrides from the database.
   * * If the database configuration table is empty (or near empty), it triggers an
   * auto-seed process using current environment variables.
   * * Updates the in-memory configuration object with values found in the database.
   * * @param repository - The repository instance used to access system settings.
   */
  async loadFromDatabase(repository: SystemConfigRepository): Promise<void> {
    if (!this.config) this.load();

    try {
      const settings = await repository.findAll();

      // Detect if DB is in an initial state (empty or minimal default entries)
      const isInitialState = settings.length <= 2;
      
      if (isInitialState) {
        logger.info('Database configuration is empty. Initializing Auto-Seed...');
        await this.seedDatabase(repository);
        // After seeding, memory config matches DB state, so no further action is needed
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

  /**
   * Populates the database with default values derived from the current environment variables.
   * * This is triggered automatically when the application detects a fresh database state.
   * * Ensures the admin panel has editable values immediately upon first launch.
   * * @param repository - The repository instance used to save settings.
   */
  private async seedDatabase(repository: SystemConfigRepository): Promise<void> {
    const config = this.config!;
    const seedData = {
      'SOURCE_BOT_IDS': config.bot.sourceBotIds.join(','),
      'FALLBACK_CHANNEL_ID': config.bot.fallbackChannelId,
      'CORE_SERVER_ID': config.discord.coreServerId,
      'DB_MAX_CONNECTIONS': config.database.maxConnections.toString(),
      'DB_MIN_CONNECTIONS': config.database.minConnections.toString()
    };

    try {
      for (const [key, value] of Object.entries(seedData)) {
        await repository.set(key, value);
      }
      logger.info('Auto-Seed: Database successfully synchronized with environment variables.');
    } catch (error) {
      logger.error('Auto-Seed failed', { error: (error as Error).message });
    }
  }

  /**
   * Retrieves the current configuration object.
   * * @throws {Error} If the configuration has not been initialized via `load()`.
   */
  get(): AppConfig {
    if (!this.config) throw new Error('Configuration not initialized.');
    return this.config;
  }

  /**
   * Helper method to parse comma-separated strings into a clean array of IDs.
   * * Filters out non-numeric values to ensure data integrity.
   */
  private parseList(value: string): string[] {
    return value.split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id));
  }
}

export const configManager = new ConfigManager();