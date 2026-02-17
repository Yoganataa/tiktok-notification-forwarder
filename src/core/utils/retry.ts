import { logger } from './logger';

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Retry ${i + 1}/${retries} failed: ${(error as Error).message}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError!;
}
