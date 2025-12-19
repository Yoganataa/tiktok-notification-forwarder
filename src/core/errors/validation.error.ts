// src/core/errors/validation.error.ts
import { AppError } from './base.error';

export class ValidationError extends AppError {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400, true);
  }
}