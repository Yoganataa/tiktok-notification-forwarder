// src/core/database/connection.ts
import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../../utils/logger';

export interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

class Database {
  private pool: Pool | null = null;
  private isShuttingDown = false;

  /**
   * Initialize database connection pool
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

    // Test connection
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
   * Execute a parameterized query
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
        params: params?.map(() => '?'), // Don't log actual params (security)
      });
      throw new DatabaseError(`Query failed: ${err.message}`, err);
    }
  }

  /**
   * Get a client for transaction management
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
   * Gracefully close all connections
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
   * Get pool statistics
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