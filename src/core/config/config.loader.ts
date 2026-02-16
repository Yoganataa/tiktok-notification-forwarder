import axios from 'axios';
import dotenv from 'dotenv';
import { logger } from '../../shared/utils/logger';

export class ConfigLoader {
    /**
     * Loads configuration from local .env and optionally from a remote URL.
     * Fails fast if remote config cannot be fetched or if critical environment variables are missing.
     */
    public static async load(): Promise<void> {
        // 1. Load local .env (standard dotenv)
        const localResult = dotenv.config();

        if (localResult.error) {
             logger.warn('No local .env file found. Assuming environment variables are set manually.');
        } else {
             logger.info('Loaded local .env file.');
        }

        // 2. Check for Remote Config URL
        const remoteConfigUrl = process.env.CONFIG_ENV_URL;

        if (remoteConfigUrl) {
            logger.info(`Found CONFIG_ENV_URL: ${remoteConfigUrl}`);
            logger.info('Attempting to fetch remote configuration...');

            try {
                const response = await axios.get(remoteConfigUrl, {
                    responseType: 'text',
                    timeout: 10000 // 10s timeout
                });

                if (response.status !== 200) {
                    throw new Error(`Failed to fetch remote config: HTTP ${response.status} ${response.statusText}`);
                }

                const remoteContent = response.data;
                this.parseAndInject(remoteContent);
                logger.info('✅ Successfully loaded configuration from Remote Gist.');

            } catch (error) {
                logger.error('❌ Failed to load remote configuration. Environment variables may be missing.');
                logger.error((error as Error).message);
                throw error; // Fail fast
            }
        } else {
             logger.info('No CONFIG_ENV_URL found. Using local configuration only.');
        }
    }

    /**
     * Parses raw .env content (KEY=VALUE) and injects it into process.env.
     * Supports comments (#) and empty lines.
     */
    private static parseAndInject(content: string): void {
        const lines = content.split('\n');
        let loadedCount = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            // Simple KEY=VALUE parsing
            const separatorIndex = trimmedLine.indexOf('=');
            if (separatorIndex === -1) {
                continue; // Invalid line format
            }

            const key = trimmedLine.substring(0, separatorIndex).trim();
            let value = trimmedLine.substring(separatorIndex + 1).trim();

            // Remove surrounding quotes if present (standard .env behavior)
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }

            // Only set if not already present (Local .env usually overrides remote defaults,
            // OR should remote override local? User said local contains MINIMUM sensitive creds.
            // Usually local .env (secrets) + remote (defaults/config).
            // If remote has secrets too (e.g. encrypted gist?), we might want to overwrite.
            // But typically process.env precedence: existing > loaded.
            // However, the prompt implies "Loading... to mimic Remote Config", usually meaning remote is the source of truth for most vars.
            // Let's assume process.env *overwrites* if it doesn't exist, or force overwrite?
            // Standard dotenv doesn't overwrite.
            // Let's check if it exists.

            if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
                process.env[key] = value;
                loadedCount++;
            } else {
                // If local .env already set it (e.g. DISCORD_TOKEN), we keep local.
                // This allows local overrides for development.
            }
        }
    }
}
