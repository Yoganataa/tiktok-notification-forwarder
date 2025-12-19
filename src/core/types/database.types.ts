// src/core/types/database.types.ts
export interface UserMapping {
  id: number;
  username: string;
  channel_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface AccessControl {
  user_id: string;
  role: UserRole;
  added_by: string;
  created_at: Date;
}

export interface SystemConfig {
  key: string;
  value: string;
  updated_at: Date;
}

export type UserRole = 'OWNER' | 'ADMIN' | 'SUDO' | 'USER';

export const ROLES: Record<UserRole, UserRole> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SUDO: 'SUDO',
  USER: 'USER',
} as const;

export type ContentType = 'live' | 'video' | 'photo' | 'unknown';
export type TikTokUsername = string;
export type Snowflake = string;