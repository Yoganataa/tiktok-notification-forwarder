// src/utils/logger.ts
import winston from 'winston';
import { configManager } from '../core/config/config';
import { LOG_CONFIG } from '../constants';

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create logger instance
 */
function createLogger() {
  let config;
  try {
    config = configManager.get();
  } catch {
    // Config not loaded yet, use defaults
    config = { app: { nodeEnv: 'development', logLevel: 'info' } };
  }

  const logFormat =
    config.app.nodeEnv === 'production'
      ? productionFormat
      : winston.format.combine(productionFormat, developmentFormat);

  return winston.createLogger({
    level: config.app.logLevel,
    format: logFormat,
    defaultMeta: {
      service: 'tiktok-forwarder-bot',
      environment: config.app.nodeEnv,
      version: '2.0.0',
    },
    transports: [
      new winston.transports.Console({
        format: developmentFormat,
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: LOG_CONFIG.MAX_SIZE,
        maxFiles: LOG_CONFIG.MAX_FILES,
        format: productionFormat,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: LOG_CONFIG.MAX_SIZE,
        maxFiles: LOG_CONFIG.MAX_FILES,
        format: productionFormat,
      }),
    ],
    exitOnError: false,
  });
}

export const logger = createLogger();
