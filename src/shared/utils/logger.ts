import winston from 'winston';
import { LOG_CONFIG } from '../../constants';
import dotenv from 'dotenv';
dotenv.config();

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

function createLogger() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';

  const logFormat = nodeEnv === 'production' ? productionFormat : winston.format.combine(productionFormat, developmentFormat);

  return winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { service: 'tiktok-forwarder-bot', environment: nodeEnv, version: '2.2.0' },
    transports: [
      new winston.transports.Console({ format: developmentFormat }),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: LOG_CONFIG.MAX_SIZE, maxFiles: LOG_CONFIG.MAX_FILES, format: productionFormat }),
      new winston.transports.File({ filename: 'logs/combined.log', maxsize: LOG_CONFIG.MAX_SIZE, maxFiles: LOG_CONFIG.MAX_FILES, format: productionFormat }),
    ],
    exitOnError: false,
  });
}

export const logger = createLogger();

export function setLogLevel(level: string) {
    logger.level = level;
}
