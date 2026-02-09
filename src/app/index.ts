import 'dotenv/config';
import './container';
import './types'; // Wire up container first
import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, ActivityType, Partials } from 'discord.js';
import path from 'path';
import { database } from '../infrastructure/database/connection';
import { configManager } from '../infrastructure/config/config';
import { logger } from '../shared/utils/logger';
import { MigrationService } from '../domain/migration.service';
import { StartupService } from '../domain/startup.service';
import { initServices } from './container';
import { container } from '@sapphire/framework';

export class AppClient extends SapphireClient {
    public constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction],
            loadMessageCommandListeners: true,
            defaultPrefix: '!',
            baseUserDirectory: path.join(__dirname, '../presentation'),
        });
    }

    public override async login(token?: string): Promise<string> {
        const config = configManager.load();

        try {
            logger.info('🚀 Starting TikTok Notification Forwarder Bot (Sapphire)...');

            await StartupService.init();

            await database.connect({
                driver: config.database.driver,
                connectionString: config.database.url,
                maxConnections: config.database.maxConnections,
                minConnections: config.database.minConnections
            });

            const migrationService = new MigrationService();
            await migrationService.run();

            await configManager.loadFromDatabase(container.repos.systemConfig);

            await initServices();

            setInterval(() => container.services.queue.processQueue(this), 5000);

            logger.info('System initialization complete. Logging in...');
            return super.login(token || config.discord.token);

        } catch (error) {
            logger.error('❌ Critical failure during application startup', {
                error: (error as Error).message,
                stack: (error as Error).stack
            });
            process.exit(1);
        }
    }

    public override async destroy() {
        await database.disconnect();
        return super.destroy();
    }
}

const client = new AppClient();

const main = async () => {
    try {
        await client.login();
        client.user?.setActivity('TikTok Live', { type: ActivityType.Watching });
    } catch (error) {
        logger.error('Failed to login', error);
    }
};

main();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
