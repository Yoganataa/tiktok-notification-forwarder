// src/core/database/transaction.ts
import { PoolClient } from 'pg';
import { Database as SQLiteDB } from 'better-sqlite3';
import { database } from './connection';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../utils/logger';

// Define a union type for our possible clients
type IDatabaseClient = PoolClient | SQLiteDB;

/**
 * Manages the lifecycle of a database transaction.
 * * Handles acquiring a dedicated client/connection, executing the transaction
 * commands (BEGIN, COMMIT, ROLLBACK), and releasing the client.
 */
export class Transaction {
  private client: any = null; // Can be PG Client or SQLite DB
  private isActive = false;
  private isPostgres = false;

  /**
   * Starts a new database transaction.
   * * Acquires a client and executes 'BEGIN'.
   */
  async begin(): Promise<void> {
    if (this.isActive) {
      throw new DatabaseError('Transaction already active');
    }

    this.client = await database.getClient();
    
    // Determine driver type for specific handling if needed
    // 'query' exists on PG Client, 'prepare' exists on SQLite
    this.isPostgres = typeof this.client.query === 'function' && !this.client.prepare;

    if (this.isPostgres) {
      await (this.client as PoolClient).query('BEGIN');
    } else {
      // SQLite (better-sqlite3)
      (this.client as SQLiteDB).prepare('BEGIN').run();
    }
    
    this.isActive = true;
    logger.debug('Transaction started');
  }

  /**
   * Commits the current transaction.
   */
  async commit(): Promise<void> {
    if (!this.isActive || !this.client) {
      throw new DatabaseError('No active transaction');
    }

    try {
      if (this.isPostgres) {
        await (this.client as PoolClient).query('COMMIT');
      } else {
        (this.client as SQLiteDB).prepare('COMMIT').run();
      }
      logger.debug('Transaction committed');
    } finally {
      this.release();
    }
  }

  /**
   * Rolls back the current transaction.
   */
  async rollback(): Promise<void> {
    if (!this.isActive || !this.client) {
      return;
    }

    try {
      if (this.isPostgres) {
        await (this.client as PoolClient).query('ROLLBACK');
      } else {
        (this.client as SQLiteDB).prepare('ROLLBACK').run();
      }
      logger.debug('Transaction rolled back');
    } finally {
      this.release();
    }
  }

  /**
   * Retrieves the active database client for this transaction.
   */
  getClient(): IDatabaseClient {
    if (!this.client || !this.isActive) {
      throw new DatabaseError('No active transaction');
    }
    return this.client;
  }

  private release() {
    if (this.client && this.isPostgres) {
      (this.client as PoolClient).release();
    }
    // SQLite connection is persistent, no release needed for the object itself
    this.isActive = false;
    this.client = null;
  }
}

/**
 * Higher-order function to execute a block of code within a transaction scope.
 * * Automatically handles `begin`, `commit`, and `rollback` logic.
 */
export async function withTransaction<T>(
  fn: (client: IDatabaseClient) => Promise<T>
): Promise<T> {
  const transaction = new Transaction();

  try {
    await transaction.begin();
    const result = await fn(transaction.getClient());
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}