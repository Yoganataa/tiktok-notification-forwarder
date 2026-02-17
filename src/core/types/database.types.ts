// src/core/types/database.types.ts

/**
 * Represents a record in the `user_mappings` table.
 * * Defines the relationship between a tracked TikTok username and the
 * Discord channel where notifications should be sent.
 */
export interface UserMapping {
  id: number;
  username: string;
  channel_id: string;
  role_id?: string | null;
  telegram_topic_id?: number | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a record in the `access_control` table.
 * * Stores the permission level (role) assigned to a specific Discord user.
 * * Used by the PermissionService to enforce access rights.
 */
export interface AccessControl {
  user_id: string;
  role: UserRole;
  added_by: string;
  created_at: Date;
}

/**
 * Represents a record in the `system_config` table.
 * * Stores dynamic application settings as key-value pairs, allowing
 * runtime configuration updates without redeployment.
 */
export interface SystemConfig {
  key: string;
  value: string;
  updated_at: Date;
}

/**
 * Union type defining available authorization levels within the application.
 * * `OWNER`: Full system access (immutable).
 * * `ADMIN`: Can manage roles and system config.
 * * `SUDO`: Can manage mappings.
 * * `USER`: Standard access (read-only).
 */
export type UserRole = 'OWNER' | 'ADMIN' | 'SUDO' | 'USER';

/**
 * Constant object dictionary for `UserRole` values.
 * * specific string literals.
 */
export const ROLES: Record<UserRole, UserRole> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SUDO: 'SUDO',
  USER: 'USER',
} as const;

/**
 * Categorizes the type of content detected from a notification.
 */
export type ContentType = 'live' | 'video' | 'photo' | 'unknown';

/**
 * Type alias for a TikTok username string.
 */
export type TikTokUsername = string;

/**
 * Type alias for a Discord Snowflake ID (represented as a string).
 */
export type Snowflake = string;
