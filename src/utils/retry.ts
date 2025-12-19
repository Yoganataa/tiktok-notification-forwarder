// src/utils/retry.ts
import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> =
  Object.freeze({
    maxAttempts: 3,
    delayMs: 1000,
    backoff: true,
  });

/**
 * Execute async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxAttempts) {
        logger.error('Operation failed after all retry attempts', {
          attempts: attempt,
          error: lastError.message,
        });
        throw lastError;
      }

      const delay = calculateDelay(attempt, opts.delayMs, opts.backoff);

      logger.warn('Operation failed, retrying', {
        attempt,
        maxAttempts: opts.maxAttempts,
        nextRetryIn: `${delay}ms`,
        error: lastError.message,
      });

      options.onRetry?.(attempt, lastError);

      await sleep(delay);
    }
  }

  throw lastError!;
}

function calculateDelay(
  attempt: number,
  baseDelay: number,
  useBackoff: boolean
): number {
  if (!useBackoff) {
    return baseDelay;
  }
  return baseDelay * Math.pow(2, attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export enum RetryableErrorType {
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE = 'DATABASE',
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly type: RetryableErrorType,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof RetryableError) {
    return true;
  }

  const message = error.message.toLowerCase();

  const retryablePatterns = [
    'timeout',
    'econnrefused',
    'enotfound',
    'network',
    'rate limit',
    'too many requests',
    'service unavailable',
    'internal server error',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}