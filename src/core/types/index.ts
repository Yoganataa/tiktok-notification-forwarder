// src/core/types/index.ts

/**
 * Core Type Definitions Barrel.
 * * Aggregates and re-exports all shared type definitions from the `database`
 * and `discord` sub-modules.
 * * Simplifies imports across the application by providing a single entry point
 * for core data structures.
 */
export * from './database.types';
export * from './discord.types';