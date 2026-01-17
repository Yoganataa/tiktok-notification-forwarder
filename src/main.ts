// src/main.ts
import { Application } from './app';
import { logger } from './infra/logger';

const app = new Application();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason) 
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  app.shutdown(1);
});

process.on('SIGINT', () => app.shutdown(0));
process.on('SIGTERM', () => app.shutdown(0));

app.start();
