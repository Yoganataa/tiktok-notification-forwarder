import { logger } from './core/utils/logger';
import { database } from './core/database/connection';
import { configManager } from './core/config/config';
import { StartupService } from './core/services/startup.service';
import { MigrationService } from './core/services/migration.service';
import { initServices } from './container';
import { container } from '@sapphire/framework';
import { TelegramClientWrapper } from './telegram/client';

const main = async () => {
    try {
        // 1. Core System Startup
        logger.info('🚀 Starting TikTok Notification Forwarder System...');

        // Load initial config (env vars)
        const config = configManager.load();

        await StartupService.init();

        // 2. Database Connection
        await database.connect({
            driver: config.database.driver,
            connectionString: config.database.url,
            maxConnections: config.database.maxConnections,
            minConnections: config.database.minConnections
        });

        // 3. Database Migrations
        const migrationService = new MigrationService();
        await migrationService.run();

        // 4. Load Dynamic Config
        await configManager.loadFromDatabase(container.repos.systemConfig);

        // 5. Initialize Core Services
        await initServices();

        // 6. Launch Telegram Client (Parallel)
        logger.info('Connecting to Telegram...');
        const telegramWrapper = new TelegramClientWrapper();
        const telegramPromise = telegramWrapper.login().catch(e => {
            logger.error('Failed to connect to Telegram', { error: (e as Error).message });
        });

        // 7. Launch Discord Client (Parallel)
        // Dynamic import to ensure container is fully set up if needed, though we imported it above.
        const { DiscordClient } = await import('./discord/client');
        const discordClient = new DiscordClient();
        const discordPromise = discordClient.login().catch(e => {
             logger.error('Failed to connect to Discord', { error: (e as Error).message });
             process.exit(1); // Critical failure for Discord
        });

        await Promise.all([telegramPromise, discordPromise]);

        logger.info('✅ System Online: Discord and Telegram (if configured) are running.');

    } catch (error) {
        logger.error('Failed to start application', error);
        process.exit(1);
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
