// src/core/database/transaction.ts
import { PoolClient } from 'pg';
import { database } from './connection';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../../utils/logger';

/**
 * Manages the lifecycle of a database transaction.
 * * Handles acquiring a dedicated client from the pool, executing the transaction
 * commands (BEGIN, COMMIT, ROLLBACK), and releasing the client back to the pool.
 */
export class Transaction {
  private client: PoolClient | null = null;
  private isActive = false;

  /**
   * Starts a new database transaction.
   * * Acquires a dedicated client from the database pool and executes the 'BEGIN' command.
   * * @throws {DatabaseError} If a transaction is already active on this instance.
   */
  async begin(): Promise<void> {
    if (this.isActive) {
      throw new DatabaseError('Transaction already active');
    }

    this.client = await database.getClient();
    await this.client.query('BEGIN');
    this.isActive = true;
    logger.debug('Transaction started');
  }

  /**
   * Commits the current transaction.
   * * Persists all changes made during the transaction and releases the client.
   * * @throws {DatabaseError} If no transaction is currently active.
   */
  async commit(): Promise<void> {
    if (!this.isActive || !this.client) {
      throw new DatabaseError('No active transaction');
    }

    try {
      await this.client.query('COMMIT');
      logger.debug('Transaction committed');
    } finally {
      this.client.release();
      this.isActive = false;
      this.client = null;
    }
  }

  /**
   * Rolls back the current transaction.
   * * Reverts all pending changes and releases the client.
   * * Safe to call even if the transaction state is inconsistent.
   */
  async rollback(): Promise<void> {
    if (!this.isActive || !this.client) {
      return;
    }

    try {
      await this.client.query('ROLLBACK');
      logger.debug('Transaction rolled back');
    } finally {
      this.client.release();
      this.isActive = false;
      this.client = null;
    }
  }

  /**
   * Retrieves the active database client for this transaction.
   * * Used to execute queries within the context of the transaction.
   * * @returns The active `PoolClient`.
   * * @throws {DatabaseError} If the transaction is not active.
   */
  getClient(): PoolClient {
    if (!this.client || !this.isActive) {
      throw new DatabaseError('No active transaction');
    }
    return this.client;
  }
}

/**
 * Higher-order function to execute a block of code within a transaction scope.
 * * Automatically handles `begin`, `commit`, and `rollback` logic.
 * * If the provided function throws an error, the transaction is automatically rolled back.
 * * @template T - The return type of the callback function.
 * @param fn - An async function that receives the transactional client.
 * @returns The result of the callback function `fn`.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
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