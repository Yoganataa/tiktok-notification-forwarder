// src/core/errors/base.error.ts

/**
 * Abstract base class for all application-specific errors.
 * * Provides a standardized structure for error handling, including error codes,
 * HTTP-like status codes, and operational status flags.
 * * Extending this class ensures consistent error reporting across the application.
 */
export abstract class AppError extends Error {
  /**
   * @param message - Human-readable description of the error.
   * @param code - Unique string identifier for the error type (e.g., 'DB_ERROR').
   * @param statusCode - Numeric status code associated with the error (default: 500).
   * @param isOperational - Flag indicating if the error is a known operational issue (true) 
   * or an unexpected programming error (false). Default is true.
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}