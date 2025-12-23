// src/commands/index.ts
import { mappingCommand } from './mapping.command';
import { menuCommand } from './menu.command';
import { adminCommand } from './admin.command';

/**
 * Centralized registry of all application slash commands.
 * * This list is used by the application during the startup phase to register 
 * or update commands with the Discord API via the REST interface.
 */
export const commandList = [mappingCommand, menuCommand, adminCommand];