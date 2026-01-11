import { PoolClient } from 'pg';
import { database } from './connection';
// import { logger } from '../logger';

/**
 * Represents the Transaction Context.
 * Using 'any' for the client to support both PG PoolClient and potential SQLite handling,
 * though in strict typing we might want a union. For now, we prioritize the pattern.
 */
export type TransactionContext = PoolClient | any;

/**
 * Executes a callback within a mandatory database transaction.
 * * The callback MUST use the provided `tx` context for all database operations.
 * * Automatically commits on success, rolls back on error.
 */
export async function withTransaction<T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> {
  const pool = await database.getClient();
  
  // POSTGRES IMPLEMENTATION
  if ((pool as any).connect && typeof (pool as any).connect === 'function') { 
      const client = await (pool as any).connect();
      try {
          await client.query('BEGIN');
          const result = await operation(client);
          await client.query('COMMIT');
          return result;
      } catch (e) {
          await client.query('ROLLBACK');
          throw e;
      } finally {
          client.release();
      }
  } 
  
  // SQLITE IMPLEMENTATION
  else {
      // Logic: SQLite doesn't need "release".
      // We start a transaction manually if possible, or just pass context.
      // better-sqlite3 `db.prepare('BEGIN').run()` works for async flow IF we handle rollback manually.
      
      try {
           pool.prepare('BEGIN').run();
           const result = await operation(pool);
           pool.prepare('COMMIT').run();
           return result;
      } catch (e) {
           try { pool.prepare('ROLLBACK').run(); } catch (err) {} // safe rollback
           throw e;
      }
  }
}
