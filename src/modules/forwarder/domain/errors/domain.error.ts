import { ValidationError } from '../../../../shared/errors/validation.error';

export class DomainError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
