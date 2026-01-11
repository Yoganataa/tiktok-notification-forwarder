// src/modules/admin/infra/admin.repository.ts
import { BaseRepository } from '../../../infra/database/base.repository';
import { UserRole } from '../../../shared/types/database.types';
import { DatabaseError } from '../../../shared/errors/database.error';
import { AccessControlRepositoryPort } from '../ports/access-control.repository.port';
import { AccessControl } from '../domain/access-control.entity';
import { TransactionContext } from '../../../infra/database/transaction';

/**
 * Helper to ensure dates are real JS Date objects.
 */
function ensureDate(val: any): Date {
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    return new Date();
}

export class AccessControlRepository extends BaseRepository implements AccessControlRepositoryPort {
    /**
     * Retrieves the role for a given user.
     */
    async getUserRole(userId: string, tx?: TransactionContext): Promise<UserRole | null> {
        const sql = `SELECT role FROM access_control WHERE user_id = $1`;
        const result = await this.queryOne<{ role: UserRole }>(sql, [userId], tx);
        return result ? result.role : null;
    }

    /**
     * Assigns or updates a user's role.
     * Uses CURRENT_TIMESTAMP for cross-database compatibility.
     */
    async upsert(data: Omit<AccessControl, 'createdAt' | 'updatedAt'>, tx: TransactionContext): Promise<AccessControl> {
        const sql = `
      INSERT INTO access_control (user_id, role, assigned_by, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET role = EXCLUDED.role, assigned_by = EXCLUDED.assigned_by, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
        const params = [data.userId, data.role, data.assignedBy];
        const row = await this.queryOne<any>(sql, params, tx);

        if (!row) throw new DatabaseError('Failed to upsert access control record.');

        return new AccessControl(
            row.user_id,
            row.role,
            row.assigned_by,
            ensureDate(row.created_at),
            ensureDate(row.updated_at)
        );
    }

    /**
     * Removes a user from the access control list.
     */
    async delete(userId: string, tx: TransactionContext): Promise<boolean> {
        const sql = `DELETE FROM access_control WHERE user_id = $1 RETURNING user_id`;
        const result = await this.query<{ user_id: string }>(sql, [userId], tx);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Lists all users with assigned roles.
     */
    async findAll(tx?: TransactionContext): Promise<AccessControl[]> {
        const sql = `SELECT * FROM access_control ORDER BY created_at DESC`;
        const rows = await this.queryMany<any>(sql, [], tx);

        return rows.map(row => new AccessControl(
            row.user_id,
            row.role,
            row.assigned_by,
            ensureDate(row.created_at),
            ensureDate(row.updated_at)
        ));
    }
}