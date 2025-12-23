// src/utils/validation.ts
import { ValidationError } from '../core/errors/validation.error';

/**
 * Checks if a string matches the format of a Discord Snowflake ID.
 * * Snowflakes are unique, time-based identifiers used by Discord containing 17 to 19 digits.
 * * @param id - The ID string to test.
 * * @returns `true` if the ID is valid format, `false` otherwise.
 */
export function validateSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Validates the format of a TikTok username against platform rules.
 * * **Rules:** 2-24 characters, can contain letters, numbers, underscores, and periods.
 * * @param username - The raw username string.
 * * @returns `true` if the username format is valid.
 */
export function validateTikTokUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.]{2,24}$/.test(username);
}

/**
 * Normalizes and validates a TikTok username for storage or API use.
 * * **Steps:** * * 1. Converts to lowercase.
 * * 2. Removes leading '@' symbol.
 * * 3. Trims whitespace.
 * * 4. Validates against regex pattern.
 * * @param username - The input username (e.g., "@User123").
 * * @returns The sanitized username string.
 * * @throws {ValidationError} If the format is invalid after sanitization.
 */
export function sanitizeAndValidateUsername(username: string): string {
  const sanitized = username.toLowerCase().replace(/^@/, '').trim();

  if (!validateTikTokUsername(sanitized)) {
    throw new ValidationError(
      'Invalid TikTok username format. Must be 2-24 characters (letters, numbers, underscores, periods only).'
    );
  }

  return sanitized;
}

/**
 * Validates a Discord Channel ID.
 * * Wrapper around `validateSnowflake` that throws a specific validation error on failure.
 * * @param channelId - The channel ID to check.
 * * @throws {ValidationError} If the format is invalid.
 */
export function validateChannelId(channelId: string): void {
  if (!validateSnowflake(channelId)) {
    throw new ValidationError('Invalid Discord channel ID format.');
  }
}

/**
 * Validates a Discord User ID.
 * * Wrapper around `validateSnowflake` that throws a specific validation error on failure.
 * * @param userId - The user ID to check.
 * * @throws {ValidationError} If the format is invalid.
 */
export function validateUserId(userId: string): void {
  if (!validateSnowflake(userId)) {
    throw new ValidationError('Invalid Discord user ID format.');
  }
}