// src/repositories/access-control.repository.ts
import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { AccessControl, UserRole } from '../core/types/database.types';
import { DatabaseError } from '../core/errors/database.error';

/**
 * Helper to ensure dates are real JS Date objects.
 */
function normalizeDate(date: string | number | Date): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Helper to map raw DB row to AccessControl object.
 */
function mapRowToAccessControl(row: any): AccessControl {
  return {
    user_id: row.user_id,
    role: row.role as UserRole,
    added_by: row.added_by,
    created_at: normalizeDate(row.created_at),
  };
}

export class AccessControlRepository extends BaseRepository {
  async getUserRole(
    userId: string,
    client?: PoolClient
  ): Promise<UserRole | null> {
    const sql = `
      SELECT role FROM access_control
      WHERE user_id = $1
      LIMIT 1
    `;

    const result = await this.queryOne<{ role: UserRole }>(
      sql,
      [userId],
      client
    );

    return result?.role ?? null;
  }

  async upsert(
    userId: string,
    role: UserRole,
    addedBy: string,
    client?: PoolClient
  ): Promise<AccessControl> {
    const sql = `
      INSERT INTO access_control (user_id, role, added_by, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET 
        role = EXCLUDED.role,
        added_by = EXCLUDED.added_by
      RETURNING *
    `;

    const result = await this.queryOne<any>(
      sql,
      [userId, role, addedBy],
      client
    );

    if (!result) {
      throw new DatabaseError('Failed to upsert access control');
    }

    return mapRowToAccessControl(result);
  }

  async delete(userId: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      DELETE FROM access_control
      WHERE user_id = $1
    `;

    const result = await this.query(sql, [userId], client);
    return (result.rowCount ?? 0) > 0;
  }

  async findAll(client?: PoolClient): Promise<AccessControl[]> {
    const sql = `
      SELECT * FROM access_control
      ORDER BY role ASC, created_at DESC
    `;

    const results = await this.queryMany<any>(sql, [], client);
    return results.map(mapRowToAccessControl);
  }
}