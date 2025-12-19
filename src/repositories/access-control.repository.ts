// src/repositories/access-control.repository.ts
import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { AccessControl, UserRole } from '../core/types/database.types';
import { DatabaseError } from '../core/errors/database.error';

export class AccessControlRepository extends BaseRepository {
  /**
   * Get user role by user ID
   */
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

  /**
   * Create or update user role
   */
  async upsert(
    userId: string,
    role: UserRole,
    addedBy: string,
    client?: PoolClient
  ): Promise<AccessControl> {
    const sql = `
      INSERT INTO access_control (user_id, role, added_by, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        role = EXCLUDED.role,
        added_by = EXCLUDED.added_by
      RETURNING *
    `;

    const result = await this.queryOne<AccessControl>(
      sql,
      [userId, role, addedBy],
      client
    );

    if (!result) {
      throw new DatabaseError('Failed to upsert access control');
    }

    return result;
  }

  /**
   * Delete user access
   */
  async delete(userId: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      DELETE FROM access_control
      WHERE user_id = $1
    `;

    const result = await this.query(sql, [userId], client);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all staff members
   */
  async findAll(client?: PoolClient): Promise<AccessControl[]> {
    const sql = `
      SELECT * FROM access_control
      ORDER BY role ASC, created_at DESC
    `;

    return this.queryMany<AccessControl>(sql, [], client);
  }
}