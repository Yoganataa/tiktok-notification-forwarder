// src/utils/retry.ts
import { logger } from './logger';

/**
 * Configuration options for retry behavior
 */
interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay between retries in milliseconds (default: 1000) */
  delayMs?: number;
  /** Whether to use exponential backoff (default: true) */
  backoff?: boolean;
  /** Optional callback invoked before each retry */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = Object.freeze({
  maxAttempts: 3,
  delayMs: 1000,
  backoff: true
});

/**
 * Executes an async function with automatic retry logic
 * 
 * @template T - Return type of the function
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to function result
 * @throws Last error if all retry attempts fail
 * 
 * @remarks
 * - Uses exponential backoff by default (delay doubles each retry)
 * - Logs warnings on retry and errors on final failure
 * - Preserves original error stack traces
 * 
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetchDataFromAPI(),
 *   { maxAttempts: 5, delayMs: 2000 }
 * );
 * ```
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
      
      // Don't retry on final attempt
      if (attempt === opts.maxAttempts) {
        logger.error('Operation failed after all retry attempts', {
          attempts: attempt,
          error: lastError.message,
          stack: lastError.stack
        });
        throw lastError;
      }

      const delay = calculateDelay(attempt, opts.delayMs, opts.backoff);

      logger.warn('Operation failed, retrying', {
        attempt,
        maxAttempts: opts.maxAttempts,
        nextRetryIn: `${delay}ms`,
        error: lastError.message
      });

      // Call custom retry callback if provided
      options.onRetry?.(attempt, lastError);

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Calculates delay for next retry attempt
 * 
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param useBackoff - Whether to apply exponential backoff
 * @returns Calculated delay in milliseconds
 */
function calculateDelay(attempt: number, baseDelay: number, useBackoff: boolean): number {
  if (!useBackoff) {
    return baseDelay;
  }
  
  // Exponential backoff: baseDelay * 2^(attempt - 1)
  return baseDelay * Math.pow(2, attempt - 1);
}

/**
 * Async sleep utility
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after specified delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry-specific error types that can be checked for conditional retry logic
 */
export enum RetryableErrorType {
  /** Network connectivity issues */
  NETWORK = 'NETWORK',
  /** Rate limiting from API */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Temporary server errors (5xx) */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Database connection issues */
  DATABASE = 'DATABASE'
}

/**
 * Custom error class for retryable operations
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
 * Checks if an error is retryable based on common patterns
 * 
 * @param error - Error to check
 * @returns true if error is likely retryable
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
    'internal server error'
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}