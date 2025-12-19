// src/utils/validation.ts
import { ValidationError } from '../core/errors/validation.error';

/**
 * Validate Discord snowflake ID
 */
export function validateSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Validate TikTok username
 */
export function validateTikTokUsername(username: string): boolean {
  // TikTok usernames: 2-24 characters, letters, numbers, underscores, periods
  return /^[a-zA-Z0-9_.]{2,24}$/.test(username);
}

/**
 * Sanitize and validate username
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
 * Validate channel ID
 */
export function validateChannelId(channelId: string): void {
  if (!validateSnowflake(channelId)) {
    throw new ValidationError('Invalid Discord channel ID format.');
  }
}

/**
 * Validate user ID
 */
export function validateUserId(userId: string): void {
  if (!validateSnowflake(userId)) {
    throw new ValidationError('Invalid Discord user ID format.');
  }
}