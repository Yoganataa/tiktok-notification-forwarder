import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { database } from '../database/connection';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../utils/logger';

export abstract class BaseRepository {
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

  protected async queryOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, client);
    return result.rows[0] ?? null;
  }

  protected async queryMany<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T[]> {
    const result = await this.query<T>(text, params, client);
    return result.rows;
  }
}
