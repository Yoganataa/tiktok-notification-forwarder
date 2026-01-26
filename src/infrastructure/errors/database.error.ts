// src/core/errors/database.error.ts
import { AppError } from './base.error';

/**
 * Represents generic database-related errors.
 * * Wraps low-level database exceptions (e.g., connection failures, query errors)
 * into a standardized application error format.
 */
export class DatabaseError extends AppError {
  /**
   * @param message - A descriptive error message.
   * @param originalError - The original error object thrown by the database driver, if available.
   */
  constructor(message: string, public readonly originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500, true);
  }
}

/**
 * Represents an error where a specific database record could not be found.
 * * Typically used when a query by ID or unique key returns no results.
 * * Maps conceptually to an HTTP 404 Not Found status.
 */
export class RecordNotFoundError extends AppError {
  /**
   * @param entity - The name of the entity being searched for (e.g., 'UserMapping').
   * @param identifier - The identifier value used in the failed lookup.
   */
  constructor(entity: string, identifier: string) {
    super(
      `${entity} with identifier '${identifier}' not found`,
      'RECORD_NOT_FOUND',
      404,
      true
    );
  }
}