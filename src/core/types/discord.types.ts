// src/core/types/discord.types.ts
import { TikTokUsername, ContentType } from './database.types';

/**
 * Represents the structured data extracted from a raw source message.
 * * This object encapsulates the core information needed to construct a 
 * forwarding notification, regardless of the source bot's format.
 */
export interface NotificationData {
  /** The TikTok username extracted from the message content. */
  username: TikTokUsername;
  /** The specific URL to the content (stream or video), if available. */
  url?: string;
  /** The category of the detected content (e.g., 'live', 'video'). */
  type: ContentType;
}

/**
 * Configuration parameters for routing a notification to a specific destination.
 * * Used by the ForwarderService to determine the target context and 
 * visual formatting rules.
 */
export interface ForwardConfig {
  /** The Discord Snowflake ID of the destination text channel. */
  channelId: string;
  /** Indicates if the source message originated from a different guild than the destination. */
  isCrossServer: boolean;
  /** The name of the source guild, used for attribution in cross-server forwards. */
  sourceServerName?: string;
  /** The Discord Role ID to tag in the notification. */
  roleId?: string | null;
}