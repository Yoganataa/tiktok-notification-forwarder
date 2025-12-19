// src/repositories/system-config.repository.ts
import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { SystemConfig } from '../core/types/database.types';

export class SystemConfigRepository extends BaseRepository {
  /**
   * Get configuration value by key
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
   * Set configuration value
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
   * Delete configuration key
   */
  async delete(key: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM system_config WHERE key = $1`;
    const result = await this.query(sql, [key], client);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all configuration entries
   */
  async findAll(client?: PoolClient): Promise<SystemConfig[]> {
    const sql = `SELECT * FROM system_config ORDER BY key ASC`;
    return this.queryMany<SystemConfig>(sql, [], client);
  }
}