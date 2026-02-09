import { PoolClient } from 'pg';
import NodeCache from 'node-cache';
import { BaseRepository } from './base.repository';
import { UserMapping } from '../types/database.types';
import { RecordNotFoundError, DatabaseError } from '../core/errors/database.error';
import { logger } from '../shared/utils/logger';

export class UserMappingRepository extends BaseRepository {
  private cache: NodeCache;

  constructor() {
    super();
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  async upsert(
    username: string,
    channelId: string,
    roleId?: string | null,
    client?: PoolClient
  ): Promise<UserMapping> {
    const cleanUsername = username.toLowerCase().trim();
    const sanitizedRoleId = roleId || null;

    const sql = `
      INSERT INTO user_mapping (username, channel_id, role_id, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username)
      DO UPDATE SET
        channel_id = EXCLUDED.channel_id,
        role_id = EXCLUDED.role_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.queryOne<UserMapping>(
      sql,
      [cleanUsername, channelId, sanitizedRoleId],
      client
    );

    if (!result) {
      throw new DatabaseError('Failed to upsert user mapping');
    }

    this.cache.set(`map_${cleanUsername}`, result);
    return result;
  }

  async findByUsername(
    username: string,
    client?: PoolClient
  ): Promise<UserMapping | null> {
    const cleanUsername = username.toLowerCase().trim();
    const cacheKey = `map_${cleanUsername}`;

    const cachedData = this.cache.get<UserMapping>(cacheKey);
    if (cachedData) return cachedData;

    const sql = `
      SELECT * FROM user_mapping
      WHERE username = $1
      LIMIT 1
    `;

    const result = await this.queryOne<UserMapping>(
      sql,
      [cleanUsername],
      client
    );

    if (result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async delete(
    username: string,
    client?: PoolClient
  ): Promise<UserMapping> {
    const cleanUsername = username.toLowerCase().trim();

    const sql = `
      DELETE FROM user_mapping
      WHERE username = $1
      RETURNING *
    `;

    const result = await this.queryOne<UserMapping>(
      sql,
      [cleanUsername],
      client
    );

    if (!result) {
      throw new RecordNotFoundError('UserMapping', username);
    }

    this.cache.del(`map_${cleanUsername}`);
    return result;
  }

  async findAll(client?: PoolClient): Promise<UserMapping[]> {
    const sql = `
      SELECT * FROM user_mapping
      ORDER BY username ASC
    `;

    return this.queryMany<UserMapping>(sql, [], client);
  }

  async count(client?: PoolClient): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM user_mapping`;
    const result = await this.queryOne<{ count: number }>(sql, [], client);
    return result?.count ?? 0;
  }
}
