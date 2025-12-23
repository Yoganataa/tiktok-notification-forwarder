// src/repositories/user-mapping.repository.ts
import { PoolClient } from 'pg';
import NodeCache from 'node-cache';
import { BaseRepository } from './base.repository';
import { UserMapping } from '../core/types/database.types';
import { RecordNotFoundError, DatabaseError } from '../core/errors/database.error';
import { logger } from '../utils/logger';

/**
 * Repository for managing TikTok User to Discord Channel mappings.
 * * Implements an **in-memory caching layer** (via `node-cache`) to minimize database 
 * load for frequently accessed read operations.
 * * Extends `BaseRepository` for standardized database interactions.
 */
export class UserMappingRepository extends BaseRepository {
  private cache: NodeCache;

  /**
   * Initializes the repository and configures the internal cache.
   * * **TTL (Time To Live):** 600 seconds (10 minutes).
   * * **Check Period:** 120 seconds for automatic cleanup of expired keys.
   */
  constructor() {
    super();
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  /**
   * Creates or updates a user mapping record.
   * * **Strategy:** Write-Through (Database First -> Cache Update).
   * * Persists the data to the database and immediately updates the cache
   * to ensure subsequent reads are consistent and fast.
   * * @param username - The TikTok username to map.
   * @param channelId - The target Discord channel ID.
   * @param client - Optional transactional database client.
   * @returns The newly created or updated mapping.
   */
  async upsert(
    username: string,
    channelId: string,
    client?: PoolClient
  ): Promise<UserMapping> {
    const cleanUsername = username.toLowerCase().trim();

    const sql = `
      INSERT INTO user_mapping (username, channel_id, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (username)
      DO UPDATE SET 
        channel_id = EXCLUDED.channel_id,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.queryOne<UserMapping>(
      sql,
      [cleanUsername, channelId],
      client
    );

    if (!result) {
      throw new DatabaseError('Failed to upsert user mapping');
    }

    this.cache.set(`map_${cleanUsername}`, result);
    logger.debug(`Cache updated for user: ${cleanUsername}`);

    return result;
  }

  /**
   * Retrieves a mapping by username.
   * * **Strategy:** Cache-Aside / Read-Through.
   * * 1. Checks memory cache first.
   * * 2. If missing (Cache Miss), queries the database.
   * * 3. Populates cache with the result for future requests.
   * * @param username - The username to search for.
   * @param client - Optional transactional database client.
   * @returns The found mapping or `null` if not found.
   */
  async findByUsername(
    username: string,
    client?: PoolClient
  ): Promise<UserMapping | null> {
    const cleanUsername = username.toLowerCase().trim();
    const cacheKey = `map_${cleanUsername}`;

    const cachedData = this.cache.get<UserMapping>(cacheKey);
    if (cachedData) {
      logger.debug(`Cache HIT for user: ${cleanUsername}`);
      return cachedData;
    }

    logger.debug(`Cache MISS for user: ${cleanUsername}, querying DB...`);
    
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

  /**
   * Deletes a mapping by username.
   * * **Strategy:** Cache Invalidation.
   * * Removes the record from the database and immediately removes the 
   * corresponding key from the cache to prevent stale data.
   * * @param username - The username to delete.
   * @param client - Optional transactional database client.
   * @returns The deleted mapping record.
   * @throws {RecordNotFoundError} If the username does not exist.
   */
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
    logger.debug(`Cache invalidated for user: ${cleanUsername}`);

    return result;
  }

  /**
   * Retrieves all user mappings from the database.
   * * **Note:** This operation is **not cached** due to potentially large dataset sizes
   * and the infrequency of full-list retrieval requirements.
   * * @param client - Optional transactional database client.
   * @returns An array of all user mappings sorted alphabetically.
   */
  async findAll(client?: PoolClient): Promise<UserMapping[]> {
    const sql = `
      SELECT * FROM user_mapping 
      ORDER BY username ASC
    `;

    return this.queryMany<UserMapping>(sql, [], client);
  }

  /**
   * Counts the total number of active mappings.
   * * @param client - Optional transactional database client.
   * @returns The total count of mappings as a number.
   */
  async count(client?: PoolClient): Promise<number> {
    const sql = `SELECT COUNT(*)::int as count FROM user_mapping`;
    const result = await this.queryOne<{ count: number }>(sql, [], client);
    return result?.count ?? 0;
  }
}