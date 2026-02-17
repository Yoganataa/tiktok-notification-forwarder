import 'dotenv/config';
import './container';
import './container.types'; // Wire up container first
import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { database } from './core/database/connection';
import { configManager } from './core/config/config';
import { logger } from './shared/utils/logger';
import { MigrationService } from './services/migration.service';
import { StartupService } from './services/startup.service';
import { initServices } from './container';
import { container } from '@sapphire/framework';

export class Application extends SapphireClient {
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
            baseUserDirectory: __dirname,
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
            container.services.scheduler.init(this);

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
