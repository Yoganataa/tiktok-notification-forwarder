// src/modules/admin/infra/system-config.repository.ts
import { BaseRepository } from '../../../infra/database/base.repository';
import { SystemConfigRepositoryPort } from '../ports/system-config.repository.port';
import { SystemConfig } from '../domain/system-config.entity';
import { TransactionContext } from '../../../infra/database/transaction';

/**
 * Utility to standardize date parsing from database results.
 */
function ensureDate(val: any): Date {
    if (val instanceof Date) return val;
    return new Date(val);
}

export class SystemConfigRepository extends BaseRepository implements SystemConfigRepositoryPort {
    /**
     * Retrieves a configuration value by key.
     */
    async get(key: string, tx?: TransactionContext): Promise<string | null> {
        const sql = `SELECT value FROM system_config WHERE key = $1`;
        const result = await this.queryOne<{ value: string }>(sql, [key], tx);
        return result ? result.value : null;
    }

    /**
     * Sets or updates a configuration key-value pair.
     * Uses CURRENT_TIMESTAMP to ensure compatibility with both SQLite and PostgreSQL.
     */
    async set(key: string, value: string, tx: TransactionContext): Promise<void> {
        const sql = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `;
        await this.query(sql, [key, value], tx);
    }

    /**
     * Deletes a configuration key.
     */
    async delete(key: string, tx: TransactionContext): Promise<boolean> {
        const sql = `DELETE FROM system_config WHERE key = $1`;
        const result = await this.query(sql, [key], tx);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Retrieves all configuration entries.
     */
    async findAll(tx?: TransactionContext): Promise<SystemConfig[]> {
        const sql = `SELECT * FROM system_config ORDER BY key ASC`;
        const rows = await this.queryMany<any>(sql, [], tx);
        return rows.map(row => new SystemConfig(row.key, row.value, ensureDate(row.updated_at)));
    }
}