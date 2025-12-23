// src/repositories/base.repository.ts
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { database } from '../core/database/connection';
import { DatabaseError } from '../core/errors/database.error';
import { logger } from '../utils/logger';

/**
 * Abstract Base Repository Class.
 * * Provides a standardized layer for database interaction across all repositories.
 * * encapsulation logic for executing queries via the global pool or a specific
 * transactional client.
 * * Handles centralized error logging and exception wrapping.
 */
export abstract class BaseRepository {
  /**
   * Executes a raw SQL query against the database.
   * * Automatically delegates execution to either the specific transactional client
   * (if provided) or the global connection pool.
   * * Wraps any low-level driver errors into a `DatabaseError`.
   * * @template T - The expected shape of the resulting rows.
   * @param text - The SQL query string.
   * @param params - Optional array of values to bind to the query parameters.
   * @param client - Optional `PoolClient` instance for executing within a transaction.
   * @returns The raw `QueryResult` object containing rows and metadata.
   * @throws {DatabaseError} If the query execution fails.
   */
  protected async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    client?: PoolClient
  ): Promise<QueryResult<T>> {
    try {
      if (client) {
        return await client.query<T>(text, params);
      }
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

  /**
   * Executes a query expected to return a single record.
   * * Useful for lookups by ID or unique constraints.
   * * @template T - The expected shape of the result row.
   * @param text - The SQL query string.
   * @param params - Optional array of bind parameters.
   * @param client - Optional transactional client.
   * @returns The first row of the result set, or `null` if no rows were returned.
   */
  protected async queryOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, client);
    return result.rows[0] ?? null;
  }

  /**
   * Executes a query expected to return multiple records.
   * * @template T - The expected shape of the result rows.
   * @param text - The SQL query string.
   * @param params - Optional array of bind parameters.
   * @param client - Optional transactional client.
   * @returns An array of rows. Returns an empty array if no results are found.
   */
  protected async queryMany<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T[]> {
    const result = await this.query<T>(text, params, client);
    return result.rows;
  }
}