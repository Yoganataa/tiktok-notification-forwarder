import { logger } from './shared/utils/logger';

const main = async () => {
    try {
        // 1. Dynamic Import of Application
        const { Application } = await import('./app');

        // 2. Initialize and Start
        const client = new Application();
        await client.login();
        // client.user?.setActivity(...) is now handled in ReadyListener for dynamic updates

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
