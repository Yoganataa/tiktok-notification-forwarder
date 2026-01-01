// src/services/migration.service.ts
import fs from 'fs/promises';
import path from 'path';
import { database } from '../core/database/connection';
import { configManager } from '../core/config/config';
import { logger } from '../utils/logger';

/**
 * Service responsible for managing database schema migrations.
 * * Automatically selects the correct migration folder based on the active DB driver.
 */
export class MigrationService {
  private readonly migrationTable = '_migrations';
  private migrationPath: string;

  constructor() {
    const config = configManager.get();
    
    // Determine path based on driver
    // Assumes structure: dist/core/database/migrations/{driver_name}
    // We map 'postgres' to 'postgres' folder and 'sqlite' to 'sqlite' folder
    const driverFolder = config.database.driver === 'sqlite' ? 'sqlite' : 'postgres';
    
    this.migrationPath = path.join(
      __dirname, 
      '../core/database/migrations', 
      driverFolder
    );
  }

  /**
   * Orchestrates the migration process.
   */
  async run(): Promise<void> {
    logger.info(`Checking for database migrations in: ${this.migrationPath}`);

    await this.ensureMigrationTable();

    const files = await this.getMigrationFiles();
    if (files.length === 0) {
      logger.info('No migration files found for the current driver.');
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
   * * Logic adapted for both PG and SQLite syntax compatibility.
   */
  private async ensureMigrationTable(): Promise<void> {
    const config = configManager.get();
    
    let sql: string;
    
    if (config.database.driver === 'sqlite') {
        sql = `
        CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            executed_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        `;
    } else {
        sql = `
        CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;
    }

    await database.query(sql);
  }

  private async getMigrationFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationPath);
      return files.filter(f => f.endsWith('.sql')).sort();
    } catch (error) {
      logger.warn(`Migration directory not found: ${this.migrationPath}`);
      // Create it to prevent errors on next run (optional)
      // await fs.mkdir(this.migrationPath, { recursive: true });
      return [];
    }
  }

  private async getExecutedMigrations(): Promise<string[]> {
    const sql = `SELECT name FROM ${this.migrationTable}`;
    const result = await database.query<{ name: string }>(sql);
    return result.rows.map(r => r.name);
  }

  private async runMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationPath, filename);
    const sqlContent = await fs.readFile(filePath, 'utf-8');

    logger.info(`Executing migration: ${filename}`);
    
    // We use the simpler direct query approach here since specific transaction logic
    // is handled differently per driver in our connection.ts, but for migrations
    // we want atomic execution.
    const client = await database.getClient();
    
    // Determine how to run transaction manually based on object type
    // (This is a simplified version of what we did in transaction.ts)
    const isPostgres = typeof client.query === 'function' && !client.prepare;

    try {
        if (isPostgres) {
            await client.query('BEGIN');
            await client.query(sqlContent);
            await client.query(
                `INSERT INTO ${this.migrationTable} (name) VALUES ($1)`,
                [filename]
            );
            await client.query('COMMIT');
        } else {
            // SQLite (better-sqlite3)
            client.prepare('BEGIN').run();
            try {
                client.exec(sqlContent); // Use exec for multiple statements in one file
                client.prepare(`INSERT INTO ${this.migrationTable} (name) VALUES (?)`).run(filename);
                client.prepare('COMMIT').run();
            } catch (innerErr) {
                client.prepare('ROLLBACK').run();
                throw innerErr;
            }
        }
        
        logger.info(`Migration ${filename} completed.`);
    } catch (error) {
        if (isPostgres) {
            await client.query('ROLLBACK');
        }
        logger.error(`Migration ${filename} failed!`, { error: (error as Error).message });
        throw error;
    } finally {
        if (isPostgres) client.release();
    }
  }
}