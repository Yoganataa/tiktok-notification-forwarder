// src/infra/logger/index.ts
import winston from 'winston';
import { configManager, LogStrategy } from '../config/config';
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
        // Copy Symbols
        const symbols = Object.getOwnPropertySymbols(obj);
        for (const sym of symbols) {
            newObj[sym] = obj[sym];
        }
        return newObj;
    }
    return obj;
}

const redactSecrets = winston.format((info) => {
    return redactObject(info);
});

// ------------------------------

const developmentFormat = winston.format.combine(
  redactSecrets(),
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

const productionFormat = winston.format.combine(
  redactSecrets(),
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

function createLogger() {
  let config;
  try {
    config = configManager.get();
  } catch {
    config = { 
      app: { 
        nodeEnv: process.env.NODE_ENV || 'development', 
        logLevel: process.env.LOG_LEVEL,
        logStrategy: (process.env.LOG_STRATEGY as LogStrategy) || 'safe'
      } 
    };
  }

  // Strategy Mapping
  // safe       -> info
  // balance    -> debug
  // aggressive -> verbose (Note: winston default levels: error, warn, info, http, verbose, debug, silly)
  // Wait, default winston npm levels: error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
  // User wants aggressive -> "see EVERYTHING" -> silly or debug.
  // User wants balance -> "standard debug" -> verbose/debug?
  // User wants safe -> "no clutter" -> info.

  let logLevel = 'info';
  const strategy = config.app.logStrategy;

  switch (strategy) {
      case 'aggressive':
          logLevel = 'silly'; // Maximum verbosity
          break;
      case 'balance':
          logLevel = 'debug'; // Standard debug
          break;
      case 'safe':
      default:
          logLevel = 'info';
          break;
  }

  // Allow manual override via env if specific granularity needed
  if (config.app.logLevel) {
      logLevel = config.app.logLevel;
  }

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
      strategy: strategy
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
