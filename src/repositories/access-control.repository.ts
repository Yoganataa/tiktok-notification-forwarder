// src/repositories/access-control.repository.ts
import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { AccessControl, UserRole } from '../core/types/database.types';
import { DatabaseError } from '../core/errors/database.error';

/**
 * Repository for managing User Access Control (ACL).
 * * Handles database operations related to user roles and permissions.
 * * Extends the BaseRepository for shared connection logic.
 */
export class AccessControlRepository extends BaseRepository {
  /**
   * Retrieves the role assigned to a specific user ID.
   * * @param userId - The Discord user ID to query.
   * * @param client - Optional transactional database client.
   * * @returns The assigned `UserRole` or `null` if the user has no special access.
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
   * Assigns or updates a role for a specific user.
   * * Performs an UPSERT operation: Inserts a new record or updates the existing one
   * if the `user_id` constraint conflicts.
   * * @param userId - The target Discord user ID.
   * * @param role - The specific role to assign (e.g., ADMIN, SUDO).
   * * @param addedBy - The Discord ID of the administrator performing the action.
   * * @param client - Optional transactional database client.
   * * @returns The newly created or updated `AccessControl` record.
   * * @throws {DatabaseError} If the operation fails to return a result.
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
   * Revokes access by deleting the user's role record.
   * * @param userId - The Discord user ID to remove.
   * * @param client - Optional transactional database client.
   * * @returns `true` if a record was deleted, `false` if the user was not found.
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
   * Retrieves all registered staff members.
   * * Results are sorted by Role priority (alphabetical) and then by creation date (newest first).
   * * @param client - Optional transactional database client.
   * * @returns An array of all `AccessControl` records.
   */
  async findAll(client?: PoolClient): Promise<AccessControl[]> {
    const sql = `
      SELECT * FROM access_control
      ORDER BY role ASC, created_at DESC
    `;

    return this.queryMany<AccessControl>(sql, [], client);
  }
}