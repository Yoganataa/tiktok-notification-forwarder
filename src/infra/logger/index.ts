// src/infra/logger/index.ts
import winston from 'winston';
import { configManager } from '../config/config';
import { LOG_CONFIG, APP_VERSION } from '../../shared/constants';
import dotenv from 'dotenv';
dotenv.config();

// --- SECRET REDACTION LOGIC ---

const SENSITIVE_KEYS = [
    'token', 'password', 'secret', 'key', 'auth', 'cookie', 'access_token', 'refresh_token', 'client_id', 'client_secret'
];

/**
 * Recursively masks sensitive values in an object.
 */
function redactObject(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj.map(redactObject);
    if (typeof obj === 'object') {
        const newObj: any = {};
        for (const key of Object.keys(obj)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
                newObj[key] = '[REDACTED]';
            } else {
                newObj[key] = redactObject(obj[key]);
            }
        }
        // Copy Symbols (important for Winston internals)
        const symbols = Object.getOwnPropertySymbols(obj);
        for (const sym of symbols) {
            newObj[sym] = obj[sym];
        }
        return newObj;
    }
    return obj;
}

/**
 * Winston Formatter that acts as a middleware to scrub secrets.
 */
const redactSecrets = winston.format((info) => {
    return redactObject(info);
});

// ------------------------------

/**
 * Custom log format for development environments.
 * * Features colorized output and human-readable timestamps.
 * * serializes metadata objects for easier debugging in the console.
 */
const developmentFormat = winston.format.combine(
  redactSecrets(), // <--- Apply Redaction
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Filter out symbols from meta display
    const visibleMeta: any = {};
    for (const key of Object.keys(meta)) {
         visibleMeta[key] = meta[key];
    }
    const metaStr =
      Object.keys(visibleMeta).length > 0 ? `\n${JSON.stringify(visibleMeta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * Standardized log format for production environments.
 * * Uses structured JSON formatting for easy ingestion by log aggregation tools (e.g., ELK Stack).
 * * Includes full stack traces for error-level logs.
 */
const productionFormat = winston.format.combine(
  redactSecrets(), // <--- Apply Redaction
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Factory function to instantiate the Winston logger.
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
        logLevel: process.env.LOG_LEVEL || 'debug' // Default to verbose (debug) if missing
      } 
    };
  }

  // Force debug level if requested by user for "verbose all logs"
  const logLevel = process.env.LOG_LEVEL || 'debug';

  const logFormat =
    config.app.nodeEnv === 'production'
      ? productionFormat
      : winston.format.combine(productionFormat, developmentFormat);

  return winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: {
      service: 'tiktok-forwarder-bot',
      environment: config.app.nodeEnv,
      version: APP_VERSION,
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
