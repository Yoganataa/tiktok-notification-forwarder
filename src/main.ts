import { Application } from './app';
import { ActivityType } from 'discord.js';
import { logger } from './shared/utils/logger';

const client = new Application();

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
