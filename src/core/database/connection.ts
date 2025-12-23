// src/core/database/connection.ts
import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../../utils/logger';

/**
 * Configuration interface for the Database connection.
 * * Defines the parameters required to establish a connection pool.
 */
export interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Singleton Database Wrapper Class.
 * * Manages the PostgreSQL connection pool using `pg`.
 * * Provides methods for executing queries, transaction management, and graceful shutdown.
 */
class Database {
  private pool: Pool | null = null;
  private isShuttingDown = false;

  /**
   * Initializes the database connection pool.
   * * Configures the pool with provided settings (SSL, timeouts, limits).
   * * Sets up event listeners for pool errors and connection events.
   * * Performs an immediate connectivity test ('SELECT 1') to validate the configuration.
   * * @param config - The database configuration object.
   * * @throws {DatabaseError} If the initial connection test fails.
   */
  async connect(config: DatabaseConfig): Promise<void> {
    if (this.pool) {
      logger.warn('Database already connected');
      return;
    }

    const poolConfig: PoolConfig = {
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      min: config.minConnections ?? 2,
      max: config.maxConnections ?? 10,
      idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMs ?? 5000,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });

    this.pool.on('connect', () => {
      logger.debug('New database client connected');
    });

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connection established successfully');
    } catch (error) {
      throw new DatabaseError(
        'Failed to establish database connection',
        error as Error
      );
    }
  }

  /**
   * Executes a parameterized SQL query against the pool.
   * * Wraps the native query execution with performance logging and error handling.
   * * Automatically masks query parameters in logs for security.
   * * @template T - The expected shape of the resulting rows.
   * * @param text - The SQL query string.
   * * @param params - Optional array of values to substitute into the query.
   * * @returns The result of the query including rows and row count.
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new DatabaseError('Database not initialized');
    }

    const start = Date.now();
    
    try {
      const result = await this.pool.query<T>(text, params);
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
        params: params?.map(() => '?'),
      });
      throw new DatabaseError(`Query failed: ${err.message}`, err);
    }
  }

  /**
   * Acquires a raw client from the pool.
   * * Useful for operations requiring a dedicated client, such as transactions (BEGIN/COMMIT).
   * * **Important:** The caller is responsible for releasing the client back to the pool.
   * * @returns A promise that resolves to a `PoolClient`.
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new DatabaseError('Database not initialized');
    }

    try {
      return await this.pool.connect();
    } catch (error) {
      throw new DatabaseError(
        'Failed to acquire database client',
        error as Error
      );
    }
  }

  /**
   * Gracefully shuts down the database connection pool.
   * * Waits for active clients to finish before closing (handled by `pool.end()`).
   * * Prevents new connections during the shutdown phase.
   */
  async disconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        logger.info('Database connections closed successfully');
      } catch (error) {
        logger.error('Error closing database connections', {
          error: (error as Error).message,
        });
        throw new DatabaseError(
          'Failed to close database connections',
          error as Error
        );
      }
    }
  }

  /**
   * Retrieves current statistics about the connection pool.
   * * Useful for monitoring health and load.
   * * @returns An object containing total, idle, and waiting client counts.
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Singleton instance
export const database = new Database();