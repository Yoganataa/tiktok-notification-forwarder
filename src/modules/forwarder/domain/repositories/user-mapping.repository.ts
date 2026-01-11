import { UserMapping } from '../entities/user-mapping.entity';
import { TikTokUsername } from '../value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../value-objects/discord-channel-id.vo';
import { TransactionContext } from '../../../../infra/database/transaction';

export interface UserMappingRepository {
  save(mapping: UserMapping, tx: TransactionContext): Promise<void>;
  remove(username: TikTokUsername, channelId: DiscordChannelId, tx: TransactionContext): Promise<boolean>;
  findByUsername(username: TikTokUsername, tx: TransactionContext): Promise<UserMapping[]>;
  findByChannel(channelId: DiscordChannelId, tx: TransactionContext): Promise<UserMapping[]>;
  findAll(tx: TransactionContext): Promise<UserMapping[]>;
  list(limit: number, offset: number, tx: TransactionContext): Promise<{ data: UserMapping[], total: number }>;
}
