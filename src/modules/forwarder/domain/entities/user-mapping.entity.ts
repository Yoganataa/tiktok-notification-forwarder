import { TikTokUsername } from '../value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../value-objects/discord-channel-id.vo';

export class UserMapping {
  private constructor(
    public readonly username: TikTokUsername,
    public readonly channelId: DiscordChannelId,
    public readonly roleIdToTag: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(
    username: TikTokUsername,
    channelId: DiscordChannelId,
    roleIdToTag?: string | null
  ): UserMapping {
    return new UserMapping(
      username,
      channelId,
      roleIdToTag ?? null,
      new Date(),
      new Date()
    );
  }

  // Necessary for generic persistence rehydration
  static reconstruct(
    username: TikTokUsername,
    channelId: DiscordChannelId,
    roleIdToTag: string | null,
    createdAt: Date,
    updatedAt: Date
  ): UserMapping {
    return new UserMapping(
      username,
      channelId,
      roleIdToTag,
      createdAt,
      updatedAt
    );
  }
}
