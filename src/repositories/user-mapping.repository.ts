// src/repositories/user-mapping.repository.ts
import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { UserMapping } from '../core/types/database.types';
import { RecordNotFoundError } from '../core/errors/database.error';
import { DatabaseError } from '../core/errors/database.error';

export class UserMappingRepository extends BaseRepository {
  /**
   * Create or update a user mapping
   */
  async upsert(
    username: string,
    channelId: string,
    client?: PoolClient
  ): Promise<UserMapping> {
    const sql = `
      INSERT INTO user_mapping (username, channel_id, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (username)
      DO UPDATE SET
        channel_id = EXCLUDED.channel_id,
        updated_at = NOW()
      RETURNING *
    `;

    const cleanUsername = username.toLowerCase().trim();
    const result = await this.queryOne<UserMapping>(
      sql,
      [cleanUsername, channelId],
      client
    );

    if (!result) {
      throw new DatabaseError('Failed to upsert user mapping');
    }

    return result;
  }

  /**
   * Find mapping by username
   */
  async findByUsername(
    username: string,
    client?: PoolClient
  ): Promise<UserMapping | null> {
    const sql = `
      SELECT * FROM user_mapping
      WHERE username = $1
      LIMIT 1
    `;

    return this.queryOne<UserMapping>(
      sql,
      [username.toLowerCase().trim()],
      client
    );
  }

  /**
   * Delete mapping by username
   */
  async delete(
    username: string,
    client?: PoolClient
  ): Promise<UserMapping> {
    const sql = `
      DELETE FROM user_mapping
      WHERE username = $1
      RETURNING *
    `;

    const result = await this.queryOne<UserMapping>(
      sql,
      [username.toLowerCase().trim()],
      client
    );

    if (!result) {
      throw new RecordNotFoundError('UserMapping', username);
    }

    return result;
  }

  /**
   * Get all mappings
   */
  async findAll(client?: PoolClient): Promise<UserMapping[]> {
    const sql = `
      SELECT * FROM user_mapping
      ORDER BY username ASC
    `;

    return this.queryMany<UserMapping>(sql, [], client);
  }

  /**
   * Count total mappings
   */
  async count(client?: PoolClient): Promise<number> {
    const sql = `SELECT COUNT(*)::int as count FROM user_mapping`;
    const result = await this.queryOne<{ count: number }>(sql, [], client);
    return result?.count ?? 0;
  }
}