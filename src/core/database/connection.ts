// src/core/database/connection.ts
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import DatabaseConstructor, { Database as SQLiteDB } from 'better-sqlite3';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../../shared/utils/logger';
import { DatabaseDriver } from '../config/config';

/**
 * Configuration interface for the Database connection.
 */
export interface DatabaseConfig {
  driver: DatabaseDriver;
  connectionString: string;
  ssl?: boolean;
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Interface defining the contract for Database Adapters.
 * Ensures consistent behavior regardless of the underlying driver.
 */
export interface IDatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  getRawClient(): Promise<any>;
}

/**
 * PostgreSQL Implementation using 'pg'
 */
class PostgresAdapter implements IDatabaseAdapter {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      min: config.minConnections ?? 2,
      max: config.maxConnections ?? 10,
      idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMs ?? 5000,
    });
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return await this.pool.query<T>(text, params);
  }

  async getRawClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  getStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

/**
 * SQLite Implementation using 'better-sqlite3'
 */
class SqliteAdapter implements IDatabaseAdapter {
  private db: SQLiteDB | null = null;
  private path: string;

  constructor(config: DatabaseConfig) {
    // Remove protocol prefix if present (sqlite://)
    this.path = config.connectionString.replace('sqlite://', '');
  }

  async connect(): Promise<void> {
    try {
      this.db = new DatabaseConstructor(this.path);
      this.db.pragma('journal_mode = WAL'); // Optimization
      this.db.prepare('SELECT 1').run();
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.db) throw new Error('Database closed');

    // Normalize Parameters: Convert Postgres style ($1, $2) to SQLite style (?)
    const normalizedText = text.replace(/\$\d+/g, '?');

    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db!.prepare(normalizedText);
        let rows: T[] = [];
        let rowCount = 0;

        if (stmt.reader) {
          rows = stmt.all(params || []) as T[];
          rowCount = rows.length;
        } else {
          const info = stmt.run(params || []);
          rowCount = info.changes;
          // Imitate RETURNING behavior for inserts if needed, but basic support handles rowCount
          if (text.toLowerCase().includes('returning') && info.lastInsertRowid) {
             // Note: Better-sqlite3 does not natively support RETURNING clause perfectly in run()
             // for the result set without extra logic, but for simple migrations/inserts it works.
          }
        }

        // Return a shape mimicking pg.QueryResult
        resolve({
          rows,
          rowCount,
          command: text.split(' ')[0],
          oid: 0,
          fields: []
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async getRawClient(): Promise<SQLiteDB> {
    if (!this.db) throw new Error('Database closed');
    return this.db;
  }
}

/**
 * Main Database Wrapper
 * Acts as the Factory and Proxy for the specific adapter.
 */
class Database {
  private adapter: IDatabaseAdapter | null = null;
  private isShuttingDown = false;

  async connect(config: DatabaseConfig): Promise<void> {
    if (this.adapter) {
      logger.warn('Database already connected');
      return;
    }

    try {
      if (config.driver === 'sqlite') {
        logger.info('Initializing SQLite Adapter...');
        this.adapter = new SqliteAdapter(config);
      } else {
        logger.info('Initializing PostgreSQL Adapter...');
        this.adapter = new PostgresAdapter(config);
      }

      await this.adapter.connect();
      logger.info('Database connection established successfully');
    } catch (error) {
      throw new DatabaseError('Failed to establish database connection', error as Error);
    }
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.adapter) throw new DatabaseError('Database not initialized');
    
    const start = Date.now();
    try {
      const result = await this.adapter.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        duration: `${duration}ms`,
        rows: result.rowCount ?? 0,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('Database query error', {
        error: err.message,
        query: text,
        params: params?.map(() => '?'), // Mask params
      });
      throw new DatabaseError(`Query failed: ${err.message}`, err);
    }
  }

  async getClient(): Promise<any> {
    if (!this.adapter) throw new DatabaseError('Database not initialized');
    return this.adapter.getRawClient();
  }

  async disconnect(): Promise<void> {
    if (this.isShuttingDown || !this.adapter) return;
    this.isShuttingDown = true;

    try {
      await this.adapter.disconnect();
      this.adapter = null;
      logger.info('Database connections closed successfully');
    } catch (error) {
      logger.error('Error closing database connections', { error: (error as Error).message });
      throw new DatabaseError('Failed to close database connections', error as Error);
    }
  }

  getPoolStats() {
    if (this.adapter instanceof PostgresAdapter) {
      return this.adapter.getStats();
    }
    return null; // SQLite does not have a pool
  }
}

export const database = new Database();