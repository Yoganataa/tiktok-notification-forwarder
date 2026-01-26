// src/core/errors/validation.error.ts
import { AppError } from './base.error';

/**
 * Represents errors arising from invalid data input or business rule violations.
 * * Typically used when user input fails validation checks (e.g., regex mismatch, invalid types).
 * * Maps conceptually to an HTTP 400 Bad Request status.
 */
export class ValidationError extends AppError {
  /**
   * @param message - The general error message describing the validation failure.
   * @param fields - Optional dictionary of specific field names and their corresponding error messages.
   */
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400, true);
  }
}