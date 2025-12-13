// src/lib/prisma.ts
/**
 * src/lib/prisma.ts
 *
 * Create a PrismaClient instance using @prisma/adapter-pg with a pg.Pool
 * built from parsed connection details. This avoids brittle behavior caused
 * by unencoded characters inside a single DATABASE_URL string.
 *
 * TSDoc provided for exported prisma instance.
 */

import 'dotenv/config'; 
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Parse connection information from DATABASE_URL (if present) into a
 * pg Pool config object. For malformed urls, fallback to passing the
 * raw connection string to Pool (after warning).
 *
 * @returns {Pool} configured pg Pool instance
 */
function createPgPool(): Pool {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!raw) {
    throw new Error('DATABASE_URL or DIRECT_URL must be set in environment');
  }

  try {
    const url = new URL(raw);
    const user = url.username ? decodeURIComponent(url.username) : undefined;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    const host = url.hostname;
    const port = url.port ? Number(url.port) : 5432;
    const database = url.pathname ? url.pathname.replace(/^\//, '') : undefined;

    // SSL detection for cloud providers (Supabase etc.)
    const ssl =
      url.searchParams.get('sslmode') === 'require' ||
      url.searchParams.get('ssl') === 'true' ||
      url.port === '5432' // heuristic; override via env if needed
        ? { rejectUnauthorized: false }
        : undefined;

    return new Pool({
      host,
      port,
      user,
      password,
      database,
      ssl,
      // optional: set idleTimeoutMillis / connectionTimeoutMillis according to DATABASE_DEFAULTS
    });
  } catch (err) {
    // If URL parsing fails (e.g. unencoded @ inside password), fallback to raw string.
    // This maximizes compatibility but we log the issue so operator can fix .env.
    console.warn('Warning: Failed to parse DATABASE_URL with URL parser. Falling back to raw connection string. Consider URL-encoding credentials.');
    return new Pool({ connectionString: raw });
  }
}

/**
 * PostgreSQL connection pool instance used by Prisma adapter.
 */
const pool = createPgPool();

/**
 * Prisma PostgreSQL adapter
 */
const adapter = new PrismaPg(pool);

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma singleton instance exported for application use.
 *
 * @returns PrismaClient
 */
export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
