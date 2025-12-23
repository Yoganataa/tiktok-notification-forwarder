// src/utils/retry.ts
import { logger } from './logger';

/**
 * Configuration options for the retry mechanism.
 */
export interface RetryOptions {
  /** Maximum number of attempts before throwing the error. Default: 3. */
  maxAttempts?: number;
  /** Base delay in milliseconds between attempts. Default: 1000ms. */
  delayMs?: number;
  /** Whether to use exponential backoff strategy. Default: true. */
  backoff?: boolean;
  /** Callback function executed on every failed attempt before the next retry. */
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> =
  Object.freeze({
    maxAttempts: 3,
    delayMs: 1000,
    backoff: true,
  });

/**
 * Executes an asynchronous function with automatic retry logic.
 * * Handles transient failures by retrying the operation based on the provided configuration.
 * * Supports exponential backoff to reduce load on failing services.
 * * @template T - The return type of the function being executed.
 * @param fn - The asynchronous function to execute.
 * @param options - Custom retry configuration (overrides defaults).
 * @returns The result of the successful execution of `fn`.
 * @throws The last encountered error if all retry attempts fail.
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

  // Should technically be unreachable due to the throw inside the loop
  throw lastError!;
}

/**
 * Calculates the wait time for the next retry attempt.
 * * Applies exponential backoff formula: `base * 2^(attempt - 1)` if enabled.
 */
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

/**
 * Pauses execution for a specified duration.
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Categorization of errors that are deemed safe to retry.
 */
export enum RetryableErrorType {
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE = 'DATABASE',
}

/**
 * Custom error class to explicitly mark an error as retryable.
 * * Useful for controlling retry behavior from deep within business logic.
 */
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

/**
 * Determines if a given error represents a transient failure that warrants a retry.
 * * Checks against known retryable patterns (Network, Timeout, Rate Limits)
 * or explicit `RetryableError` instances.
 * @param error - The error to evaluate.
 */
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