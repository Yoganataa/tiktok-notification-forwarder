import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { SystemConfig } from '../../types/database.types';

export class SystemConfigRepository extends BaseRepository {
  async get(key: string, client?: PoolClient): Promise<string | null> {
    const sql = `SELECT value FROM system_config WHERE key = $1`;
    const result = await this.queryOne<{ value: string }>(sql, [key], client);
    return result?.value ?? null;
  }

  async set(key: string, value: string, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `;
    await this.query(sql, [key, value], client);
  }

  async findAll(client?: PoolClient): Promise<SystemConfig[]> {
    const sql = `SELECT * FROM system_config`;
    return this.queryMany<SystemConfig>(sql, [], client);
  }
}
