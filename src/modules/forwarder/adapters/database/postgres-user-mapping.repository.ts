import { BaseRepository } from '../../../../infra/database/base.repository';
import { UserMappingRepository } from '../../domain/repositories/user-mapping.repository';
import { UserMapping } from '../../domain/entities/user-mapping.entity';
import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';
import { DbUserMappingRow } from '../../../../shared/types/database.types';
import { TransactionContext } from '../../../../infra/database/transaction';

export class PostgresUserMappingRepository extends BaseRepository implements UserMappingRepository {
  async save(mapping: UserMapping, tx: TransactionContext): Promise<void> {
    await this.query(
      `
      INSERT INTO user_mappings
        (tiktok_username, discord_channel_id, role_id_to_tag, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tiktok_username, discord_channel_id) 
      DO UPDATE SET
        role_id_to_tag = EXCLUDED.role_id_to_tag,
        updated_at = EXCLUDED.updated_at
      `,
      [
        mapping.username.value,
        mapping.channelId.value,
        mapping.roleIdToTag,
        mapping.createdAt,
        mapping.updatedAt,
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
    return (result.rowCount ?? 0) > 0;
  }

  async findByUsername(username: TikTokUsername, tx: TransactionContext): Promise<UserMapping[]> {
    const rows = await this.queryMany<DbUserMappingRow>(
      `SELECT * FROM user_mappings WHERE tiktok_username = $1`,
      [username.value],
      tx
    );
    return rows.map(this.mapRowToEntity);
  }

  async findByChannel(channelId: DiscordChannelId, tx: TransactionContext): Promise<UserMapping[]> {
    const client = (tx as any).client; // Using any for now to bypass strict type check on private/internal types if export missing
    const query = 'SELECT * FROM user_mappings WHERE discord_channel_id = $1';
    const result = await client.query(query, [channelId.value]);
    
    return result.rows.map(this.mapRowToEntity);
  }

  async findAll(tx: TransactionContext): Promise<UserMapping[]> {
    const client = (tx as any).client;
    const query = 'SELECT * FROM user_mappings';
    const result = await client.query(query);
    
    return result.rows.map(this.mapRowToEntity);
  }

  async list(limit: number, offset: number, tx: TransactionContext): Promise<{ data: UserMapping[], total: number }> {
    const client = (tx as any).client;
    
    // Get Data
    const dataQuery = 'SELECT * FROM user_mappings LIMIT $1 OFFSET $2';
    const dataResult = await client.query(dataQuery, [limit, offset]);

    // Get Total
    const countQuery = 'SELECT COUNT(*) as count FROM user_mappings';
    const countResult = await client.query(countQuery);
    
    return {
      data: dataResult.rows.map(this.mapRowToEntity),
      total: parseInt(countResult.rows[0].count, 10)
    };
  }

  private mapRowToEntity(row: DbUserMappingRow): UserMapping {
    return UserMapping.reconstruct(
      TikTokUsername.create(row.tiktok_username),
      DiscordChannelId.create(row.discord_channel_id),
      row.role_id_to_tag,
      row.created_at,
      row.updated_at
    );
  }
}
