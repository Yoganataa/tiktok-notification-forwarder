import { ForwarderLogger } from '../../ports/logger.port';
import { logger } from '../../../../infra/logger';

export class WinstonLoggerAdapter implements ForwarderLogger {
    info(message: string, meta?: any): void {
        logger.info(message, meta);
    }
    warn(message: string, meta?: any): void {
        logger.warn(message, meta);
    }
    error(message: string, meta?: any): void {
        logger.error(message, meta);
    }
}
