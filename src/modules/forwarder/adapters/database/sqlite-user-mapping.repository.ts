import { BaseRepository } from '../../../../infra/database/base.repository';
import { UserMappingRepository } from '../../domain/repositories/user-mapping.repository';
import { UserMapping } from '../../domain/entities/user-mapping.entity';
import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';
import { DbUserMappingRow } from '../../../../shared/types/database.types';
import { TransactionContext } from '../../../../infra/database/transaction';

export class SqliteUserMappingRepository extends BaseRepository implements UserMappingRepository {
  async save(mapping: UserMapping, tx: TransactionContext): Promise<void> {
    await this.query(
      `
      INSERT INTO user_mappings
        (tiktok_username, discord_channel_id, role_id_to_tag, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tiktok_username, discord_channel_id) 
      DO UPDATE SET
        role_id_to_tag = excluded.role_id_to_tag,
        updated_at = excluded.updated_at
      `,
      [
        mapping.username.value,
        mapping.channelId.value,
        mapping.roleIdToTag,
        mapping.createdAt.toISOString(),
        mapping.updatedAt.toISOString(),
      ],
      tx
    );
  }

  async remove(username: TikTokUsername, channelId: DiscordChannelId, tx: TransactionContext): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM user_mappings WHERE tiktok_username = $1 AND discord_channel_id = $2`,
      [username.value, channelId.value],
      tx
    );
    // In SQLite via BaseRepo, rowCount might differ or be absent depending on driver version, 
    // but better-sqlite3 usually returns changes. 
    // Assuming BaseRepo normalizes this or we accept that 'changes' is what we need.
    // For now assuming BaseRepo behavior.
    return (result.rowCount ?? 0) > 0;
  }

  async findByUsername(username: TikTokUsername, tx: TransactionContext): Promise<UserMapping[]> {
    const rows = await this.queryMany<DbUserMappingRow>(
      `SELECT * FROM user_mappings WHERE tiktok_username = $1`,
      [username.value],
      tx
    );
    return rows.map(this.toDomain);
  }

  async findByChannel(channelId: DiscordChannelId, tx: TransactionContext): Promise<UserMapping[]> {
    const rows = await this.queryMany<DbUserMappingRow>(
      `SELECT * FROM user_mappings WHERE discord_channel_id = $1`,
      [channelId.value],
      tx
    );
    return rows.map(this.toDomain);
  }

  async findAll(tx: TransactionContext): Promise<UserMapping[]> {
    const rows = await this.queryMany<DbUserMappingRow>(
      `SELECT * FROM user_mappings`,
      [],
      tx
    );
    return rows.map(this.toDomain);
  }

  async list(limit: number, offset: number, tx: TransactionContext): Promise<{ data: UserMapping[], total: number }> {
    const rows = await this.queryMany<DbUserMappingRow>(
      `SELECT * FROM user_mappings LIMIT $1 OFFSET $2`,
      [limit, offset],
      tx
    );
    const countResult = await this.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM user_mappings`,
      [],
      tx
    );
    return {
      data: rows.map(this.toDomain),
      total: countResult ? countResult.count : 0
    };
  }

  private toDomain(row: DbUserMappingRow): UserMapping {
    return UserMapping.reconstruct(
      TikTokUsername.create(row.tiktok_username),
      DiscordChannelId.create(row.discord_channel_id),
      row.role_id_to_tag,
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}
