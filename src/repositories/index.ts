// src/repositories/index.ts

/**
 * Repository Layer Barrel.
 * * Aggregates and re-exports all data access repositories to simplify imports
 * throughout the application.
 * * Provides a single entry point for all database interaction logic, ensuring
 * a clean separation of concerns between services and data access.
 */
export * from './base.repository';
export * from './access-control.repository';
export * from './user-mapping.repository';
export * from './system-config.repository';