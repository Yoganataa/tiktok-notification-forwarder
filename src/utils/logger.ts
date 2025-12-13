// src/utils/logger.ts
import winston from 'winston';
import { config } from '../config';
import { LOG_CONFIG } from '../constants';

/**
 * Custom log format for development environment
 */
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 
      ? `\n${JSON.stringify(meta, null, 2)}` 
      : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * Custom log format for production environment
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: LOG_CONFIG.DATE_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Determines which format to use based on environment
 */
const logFormat = config.nodeEnv === 'production' 
  ? productionFormat 
  : winston.format.combine(productionFormat, developmentFormat);

/**
 * Winston logger instance with file and console transports
 * 
 * @remarks
 * - Console transport: Colored output for development
 * - File transport (error): Only error-level logs
 * - File transport (combined): All logs
 * - Automatic log rotation when files exceed max size
 */
export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { 
    service: 'tiktok-forwarder-bot',
    environment: config.nodeEnv
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: developmentFormat
    }),
    
    // Error logs only
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: LOG_CONFIG.MAX_SIZE,
      maxFiles: LOG_CONFIG.MAX_FILES,
      format: productionFormat
    }),
    
    // All logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: LOG_CONFIG.MAX_SIZE,
      maxFiles: LOG_CONFIG.MAX_FILES,
      format: productionFormat
    })
  ],
  
  // Don't exit on handled exceptions
  exitOnError: false
});