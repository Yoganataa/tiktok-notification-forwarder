import { QueryResult, QueryResultRow } from 'pg';
import { database } from './connection';
import { DatabaseError } from '../../shared/errors/database.error';
import { logger } from '../logger';
import { TransactionContext } from './transaction';

/**
 * Abstract Base Repository Class.
 */
export abstract class BaseRepository {
  /**
   * Executes a raw SQL query against the database.
   * @param tx - TransactionContext (Mandatory for write, recommended for read).
   */
  protected async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    tx?: TransactionContext
  ): Promise<QueryResult<T>> {
    try {
      // Sanitize params: convert undefined to null
      const safeParams = params?.map(p => (p === undefined ? null : p)) || [];

      if (tx) {
         // Identify if it's PG (has query method)
         if (typeof tx.query === 'function') {
             return await tx.query(text, safeParams);
         }
         // SQLite Adapter Logic (better-sqlite3)
         else if (typeof tx.prepare === 'function') {
             let normalizedText = text;
             if (text.includes('$')) {
                normalizedText = text.replace(/\$\d+/g, '?');
             }

             const stmt = tx.prepare(normalizedText);
             let rows: T[] = [];
             let rowCount = 0;

             if (stmt.reader) {
                 rows = stmt.all(safeParams) as T[];
                 rowCount = rows.length;
             } else {
                 const info = stmt.run(safeParams);
                 rowCount = info.changes;
             }
             return { rows, rowCount, command: 'SQLITE', oid: 0, fields: [] };
         }
      }

      // Fallback to pool if no tx provided (Legacy/Read-only)
      return await database.query<T>(text, safeParams);
    } catch (error) {
      const err = error as Error;
      logger.error('Repository query error', {
        repository: this.constructor.name,
        error: err.message,
      });
      throw new DatabaseError(err.message, err);
    }
  }

  protected async queryOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    tx?: TransactionContext
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, tx);
    return result.rows[0] ?? null;
  }

  protected async queryMany<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    tx?: TransactionContext
  ): Promise<T[]> {
    const result = await this.query<T>(text, params, tx);
    return result.rows;
  }
}
