// src/repositories/user-mapping.repository.ts
import { PoolClient } from 'pg';
import NodeCache from 'node-cache';
import { BaseRepository } from './base.repository';
import { UserMapping } from '../core/types/database.types';
import { RecordNotFoundError, DatabaseError } from '../core/errors/database.error';
import { logger } from '../utils/logger';

/**
 * Helper function to ensure database timestamps are converted to real JS Date objects.
 * This handles differences between SQLite (returns String) and Postgres (returns Date).
 */
function normalizeDate(date: string | number | Date): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Helper to map raw database row to strictly typed UserMapping object.
 */
function mapRowToUserMapping(row: any): UserMapping {
  return {
    id: row.id,
    username: row.username,
    channel_id: row.channel_id,
    created_at: normalizeDate(row.created_at),
    updated_at: normalizeDate(row.updated_at),
  };
}

export class UserMappingRepository extends BaseRepository {
  private cache: NodeCache;

  constructor() {
    super();
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  async upsert(
    username: string,
    channelId: string,
    client?: PoolClient
  ): Promise<UserMapping> {
    const cleanUsername = username.toLowerCase().trim();

    const sql = `
      INSERT INTO user_mapping (username, channel_id, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username)
      DO UPDATE SET 
        channel_id = EXCLUDED.channel_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.queryOne<any>(
      sql,
      [cleanUsername, channelId],
      client
    );

    if (!result) {
      throw new DatabaseError('Failed to upsert user mapping');
    }

    // Normalize output before returning
    const mapped = mapRowToUserMapping(result);

    this.cache.set(`map_${cleanUsername}`, mapped);
    logger.debug(`Cache updated for user: ${cleanUsername}`);

    return mapped;
  }

  async findByUsername(
    username: string,
    client?: PoolClient
  ): Promise<UserMapping | null> {
    const cleanUsername = username.toLowerCase().trim();
    const cacheKey = `map_${cleanUsername}`;

    const cachedData = this.cache.get<UserMapping>(cacheKey);
    if (cachedData) {
      // Re-hydrate dates from cache (JSON serialization turns dates to strings)
      return {
        ...cachedData,
        created_at: normalizeDate(cachedData.created_at),
        updated_at: normalizeDate(cachedData.updated_at)
      };
    }

    logger.debug(`Cache MISS for user: ${cleanUsername}, querying DB...`);
    
    const sql = `
      SELECT * FROM user_mapping 
      WHERE username = $1 
      LIMIT 1
    `;

    const result = await this.queryOne<any>(
      sql,
      [cleanUsername],
      client
    );

    if (result) {
      const mapped = mapRowToUserMapping(result);
      this.cache.set(cacheKey, mapped);
      return mapped;
    }

    return null;
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

    const result = await this.queryOne<any>(
      sql,
      [cleanUsername],
      client
    );

    if (!result) {
      throw new RecordNotFoundError('UserMapping', username);
    }

    const mapped = mapRowToUserMapping(result);

    this.cache.del(`map_${cleanUsername}`);
    logger.debug(`Cache invalidated for user: ${cleanUsername}`);

    return mapped;
  }

  async findAll(client?: PoolClient): Promise<UserMapping[]> {
    const sql = `
      SELECT * FROM user_mapping 
      ORDER BY username ASC
    `;

    const results = await this.queryMany<any>(sql, [], client);
    
    // Map all rows
    return results.map(mapRowToUserMapping);
  }

  async count(client?: PoolClient): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM user_mapping`;
    const result = await this.queryOne<{ count: number }>(sql, [], client);
    // Ensure count is number (Postgres returns string for BigInt count)
    return result ? parseInt(String(result.count), 10) : 0;
  }
}