// src/core/errors/database.error.ts
import { AppError } from './base.error';

export class DatabaseError extends AppError {
  constructor(message: string, public readonly originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500, true);
  }
}

export class RecordNotFoundError extends AppError {
  constructor(entity: string, identifier: string) {
    super(
      `${entity} with identifier '${identifier}' not found`,
      'RECORD_NOT_FOUND',
      404,
      true
    );
  }
}