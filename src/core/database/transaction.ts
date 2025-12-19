// src/core/database/transaction.ts
import { PoolClient } from 'pg';
import { database } from './connection';
import { DatabaseError } from '../errors/database.error';
import { logger } from '../../utils/logger';

export class Transaction {
  private client: PoolClient | null = null;
  private isActive = false;

  async begin(): Promise<void> {
    if (this.isActive) {
      throw new DatabaseError('Transaction already active');
    }

    this.client = await database.getClient();
    await this.client.query('BEGIN');
    this.isActive = true;
    logger.debug('Transaction started');
  }

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

  getClient(): PoolClient {
    if (!this.client || !this.isActive) {
      throw new DatabaseError('No active transaction');
    }
    return this.client;
  }
}

/**
 * Execute function within a transaction
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