import { ValidationError } from '../../core/errors/validation.error';

export function validateSnowflake(id: string): void {
    if (!/^\d{17,20}$/.test(id)) {
        throw new ValidationError('Invalid ID format');
    }
}
