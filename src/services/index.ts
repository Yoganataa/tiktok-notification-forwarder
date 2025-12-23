// src/services/index.ts

/**
 * Service Layer Barrel.
 * * Aggregates and re-exports all business logic services to simplify imports
 * throughout the application.
 * * Serves as the centralized public interface for the domain logic layer.
 */
export * from './forwarder.service';
export * from './notification.service';
export * from './permission.service';