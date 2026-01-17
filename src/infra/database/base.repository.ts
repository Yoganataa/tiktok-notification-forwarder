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
      if (tx) {
         // Identify if it's PG (has query method)
         if (typeof tx.query === 'function') {
             return await tx.query(text, params);
         }
         // SQLite Adapter Logic (better-sqlite3)
         else if (typeof tx.prepare === 'function') {
             // 1. Optimize param replacement: Only if $1 exists
             // We assume queries are static strings in repos, so minimal risk of injection via 'text'
             // unless developer concatenates user input (which they shouldn't).
             // However, to be safer, we could cache the prepared statement if we had a long-lived session,
             // but 'tx' is usually short-lived.

             // Simple optimization: check validity before regex
             let normalizedText = text;
             if (text.includes('$')) {
                // Replace $1, $2, etc. with ?
                // NOTE: This replaces ALL occurrences, so be careful not to use $ inside string literals in SQL.
                // e.g. "SELECT '$100'" might break.
                // Fix: Negative lookbehind is hard in JS regex across versions,
                // but for standard param usage this is "acceptable" legacy adapter logic.
                // Improvement: Only replace if followed by number.
                normalizedText = text.replace(/\$\d+/g, '?');
             }

             const stmt = tx.prepare(normalizedText);
             let rows: T[] = [];
             let rowCount = 0;

             if (stmt.reader) {
                 rows = stmt.all(params || []) as T[];
                 rowCount = rows.length;
             } else {
                 const info = stmt.run(params || []);
                 rowCount = info.changes;
             }
             // Mocking a PG-like response for compatibility
             return { rows, rowCount, command: 'SQLITE', oid: 0, fields: [] };
         }
      }

      // Fallback to pool if no tx provided (Legacy/Read-only)
      return await database.query<T>(text, params);
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
