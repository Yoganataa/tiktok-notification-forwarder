// src/services/migration.service.ts
import fs from 'fs/promises';
import path from 'path';
import { database } from '../core/database/connection';
import { logger } from '../utils/logger';

/**
 * Service responsible for managing database schema migrations.
 * * Automates the application of SQL scripts to keep the database schema in sync 
 * with the codebase.
 * * Tracks executed migrations to prevent duplicate execution.
 */
export class MigrationService {
  private readonly migrationTable = '_migrations';
  
  // Resolves to: dist/core/database/migrations based on the build structure
  private readonly migrationPath = path.join(__dirname, '../core/database/migrations');

  /**
   * Orchestrates the migration process.
   * * 1. Ensures the internal tracking table exists.
   * * 2. Scans the file system for SQL migration files.
   * * 3. Filters out migrations that have already been applied.
   * * 4. Executes pending migrations sequentially.
   */
  async run(): Promise<void> {
    logger.info('Checking for database migrations...');

    await this.ensureMigrationTable();

    const files = await this.getMigrationFiles();
    if (files.length === 0) {
      logger.info('No migration files found.');
      return;
    }

    const executed = await this.getExecutedMigrations();

    const pending = files.filter(f => !executed.includes(f));

    if (pending.length === 0) {
      logger.info('Database is up to date.');
      return;
    }

    logger.info(`Found ${pending.length} pending migrations.`);

    for (const file of pending) {
      await this.runMigration(file);
    }

    logger.info('All migrations executed successfully.');
  }

  /**
   * Creates the migration tracking table if it does not exist.
   * * This table stores the names of executed SQL files and their execution timestamps.
   */
  private async ensureMigrationTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await database.query(sql);
  }

  /**
   * Scans the configured migration directory for SQL files.
   * * Sorts files alphabetically to ensure correct execution order (e.g., 001_init, 002_update).
   * * Creates the directory if it does not exist to prevent errors.
   * * @returns A sorted list of SQL filenames.
   */
  private async getMigrationFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationPath);
      return files.filter(f => f.endsWith('.sql')).sort();
    } catch (error) {
      logger.warn('Migration directory not found, attempting to create...', { path: this.migrationPath });
      await fs.mkdir(this.migrationPath, { recursive: true });
      return [];
    }
  }

  /**
   * Retrieves the list of migrations that have already been applied to the database.
   * * @returns An array of executed migration filenames.
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const sql = `SELECT name FROM ${this.migrationTable}`;
    const result = await database.query<{ name: string }>(sql);
    return result.rows.map(r => r.name);
  }

  /**
   * Executes a single migration file within a strict database transaction.
   * * Reads the file content, executes the SQL, and records the execution in the tracking table.
   * * **Atomic Operation:** If any part fails, the entire transaction is rolled back.
   * * @param filename - The name of the SQL file to execute.
   * * @throws {Error} If the migration fails, halting the entire process.
   */
  private async runMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationPath, filename);
    const sqlContent = await fs.readFile(filePath, 'utf-8');

    logger.info(`Executing migration: ${filename}`);

    const client = await database.getClient();
    try {
      await client.query('BEGIN');
      
      await client.query(sqlContent);
      
      await client.query(
        `INSERT INTO ${this.migrationTable} (name) VALUES ($1)`,
        [filename]
      );

      await client.query('COMMIT');
      logger.info(`Migration ${filename} completed.`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration ${filename} failed!`, { error: (error as Error).message });
      throw error;
    } finally {
      client.release();
    }
  }
}