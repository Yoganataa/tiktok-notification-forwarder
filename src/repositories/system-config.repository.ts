// src/repositories/system-config.repository.ts
import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { SystemConfig } from '../core/types/database.types';

/**
 * Repository for managing dynamic system configuration.
 * * Handles CRUD operations for the `system_config` table, allowing application
 * settings to be modified at runtime without redeployment.
 */
export class SystemConfigRepository extends BaseRepository {
  /**
   * Retrieves a specific configuration value by its key.
   * * @param key - The unique configuration key (e.g., 'CORE_SERVER_ID').
   * * @param client - Optional transactional database client.
   * * @returns The configuration value as a string, or `null` if the key does not exist.
   */
  async get(key: string, client?: PoolClient): Promise<string | null> {
    const sql = `
      SELECT value FROM system_config
      WHERE key = $1
      LIMIT 1
    `;

    const result = await this.queryOne<{ value: string }>(sql, [key], client);
    return result?.value ?? null;
  }

  /**
   * Creates or updates a configuration entry.
   * * Uses an UPSERT strategy: Inserts the key if it doesn't exist, or updates
   * the value and timestamp if it does.
   * * @param key - The unique configuration key.
   * * @param value - The value to store.
   * * @param client - Optional transactional database client.
   */
  async set(key: string, value: string, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `;

    await this.query(sql, [key, value], client);
  }

  /**
   * Deletes a configuration entry permanently.
   * * @param key - The key of the configuration to remove.
   * * @param client - Optional transactional database client.
   * * @returns `true` if the key was found and deleted, `false` otherwise.
   */
  async delete(key: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM system_config WHERE key = $1`;
    const result = await this.query(sql, [key], client);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Retrieves all configuration entries currently stored in the database.
   * * Typically used during application startup or hot-reloading to sync
   * memory state with the database.
   * * @param client - Optional transactional database client.
   * * @returns An array of all `SystemConfig` records, sorted alphabetically by key.
   */
  async findAll(client?: PoolClient): Promise<SystemConfig[]> {
    const sql = `SELECT * FROM system_config ORDER BY key ASC`;
    return this.queryMany<SystemConfig>(sql, [], client);
  }
}