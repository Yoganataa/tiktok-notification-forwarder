// src/types/index.ts
/**
 * Global type definitions for the TikTok Notification Forwarder Bot
 */

/**
 * Represents a Discord snowflake ID (19-digit number as string)
 */
export type Snowflake = string;

/**
 * Represents a TikTok username (without @ symbol)
 */
export type TikTokUsername = string;

/**
 * Log metadata for structured logging
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Database operation result wrapper
 */
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Environment configuration type guard
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Helper to create success result
 */
export function Ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Helper to create error result
 */
export function Err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Content types for TikTok notifications
 */
export type ContentType = 'live' | 'video' | 'photo' | 'unknown';

/** 
 * User roles within the bot system
 */
export type UserRole = 'OWNER' | 'ADMIN' | 'SUDO' | 'USER';

export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SUDO: 'SUDO',
  USER: 'USER'
} as const;