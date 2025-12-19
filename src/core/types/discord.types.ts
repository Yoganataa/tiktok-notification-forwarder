// src/core/types/discord.types.ts
import { TikTokUsername, ContentType } from './database.types';

export interface NotificationData {
  username: TikTokUsername;
  url?: string;
  type: ContentType;
}

export interface ForwardConfig {
  channelId: string;
  isCrossServer: boolean;
  sourceServerName?: string;
}