// src/utils/logger.ts
import winston from 'winston';
import { configManager } from '../core/config/config';
import { LOG_CONFIG } from '../constants';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Custom log format for development environments.
 * * Features colorized output and human-readable timestamps.
 * * serializes metadata objects for easier debugging in the console.
 */
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * Standardized log format for production environments.
 * * Uses structured JSON formatting for easy ingestion by log aggregation tools (e.g., ELK Stack).
 * * Includes full stack traces for error-level logs.
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Factory function to instantiate the Winston logger.
 * * Implements a fail-safe mechanism to ensure logging is available even before 
 * the centralized ConfigManager is fully initialized.
 * * Configures distinct transport layers for Console (Human-readable) and File (Structured JSON).
 */
function createLogger() {
  let config;
  try {
    config = configManager.get();
  } catch {
    // Fallback configuration for boot-time logging before ConfigManager is ready
    config = { 
      app: { 
        nodeEnv: process.env.NODE_ENV || 'development', 
        logLevel: process.env.LOG_LEVEL || 'info' 
      } 
    };
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

/**
 * Global singleton logger instance.
 */
export const logger = createLogger();