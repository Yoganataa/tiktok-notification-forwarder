import fs from 'fs/promises';
import path from 'path';
import { database } from '../database/connection';
import { configManager } from '../config/config';
import { logger } from '../utils/logger';

export class MigrationService {
  private readonly migrationTable = '_migrations';
  private migrationPath: string;

  constructor() {
    const config = configManager.get();
    const driverFolder = config.database.driver === 'sqlite' ? 'sqlite' : 'postgres';

    this.migrationPath = path.join(
      __dirname,
      '../database/migrations',
      driverFolder
    );
  }

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

  private async ensureMigrationTable(): Promise<void> {
    const config = configManager.get();
    let sql: string;

    if (config.database.driver === 'sqlite') {
        sql = `CREATE TABLE IF NOT EXISTS ${this.migrationTable} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, executed_at TEXT DEFAULT CURRENT_TIMESTAMP);`;
    } else {
        sql = `CREATE TABLE IF NOT EXISTS ${this.migrationTable} (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`;
    }

    await database.query(sql);
  }

  private async getMigrationFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationPath);
      return files.filter(f => f.endsWith('.sql')).sort();
    } catch (error) {
      logger.warn(`Migration directory not found: ${this.migrationPath}`);
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
    const client = await database.getClient();
    const isPostgres = typeof client.query === 'function' && !client.prepare;

    try {
        if (isPostgres) {
            await client.query('BEGIN');
            await client.query(sqlContent);
            await client.query(`INSERT INTO ${this.migrationTable} (name) VALUES ($1)`, [filename]);
            await client.query('COMMIT');
        } else {
            client.prepare('BEGIN').run();
            try {
                client.exec(sqlContent);
                client.prepare(`INSERT INTO ${this.migrationTable} (name) VALUES (?)`).run(filename);
                client.prepare('COMMIT').run();
            } catch (innerErr) {
                client.prepare('ROLLBACK').run();
                throw innerErr;
            }
        }
        logger.info(`Migration ${filename} completed.`);
    } catch (error) {
        if (isPostgres) await client.query('ROLLBACK');
        logger.error(`Migration ${filename} failed!`, { error: (error as Error).message });
        throw error;
    } finally {
        if (isPostgres) client.release();
    }
  }
}
