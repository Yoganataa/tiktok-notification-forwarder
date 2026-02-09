import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { AccessControl, UserRole } from '../types/database.types';
import { DatabaseError } from '../core/errors/database.error';

export class AccessControlRepository extends BaseRepository {
  async getUserRole(
    userId: string,
    client?: PoolClient
  ): Promise<UserRole | null> {
    const sql = `
      SELECT role FROM access_control
      WHERE user_id = $1
    `;
    const result = await this.queryOne<{ role: UserRole }>(
      sql,
      [userId],
      client
    );
    return result?.role || null;
  }

  async getAllStaff(client?: PoolClient): Promise<AccessControl[]> {
    const sql = `
      SELECT * FROM access_control
      ORDER BY created_at DESC
    `;
    return this.queryMany<AccessControl>(sql, [], client);
  }

  async upsert(
    userId: string,
    role: UserRole,
    addedBy: string,
    client?: PoolClient
  ): Promise<void> {
    const sql = `
      INSERT INTO access_control (user_id, role, added_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role, added_by = EXCLUDED.added_by
    `;
    await this.query(sql, [userId, role, addedBy], client);
  }

  async delete(userId: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM access_control WHERE user_id = $1`;
    const result = await this.query(sql, [userId], client);
    return (result.rowCount ?? 0) > 0;
  }
}
