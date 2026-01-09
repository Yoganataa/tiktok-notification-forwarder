// src/commands/index.ts
import { mappingCommand } from './mapping.command';
import { menuCommand } from './menu.command';
import { adminCommand } from './admin.command';
// FIX: Import function, bukan constant
import { getTiktokCommand } from './tiktok.command';

/**
 * Returns the list of active application commands.
 * * Changed to a function to allow dynamic command generation based on config.
 */
export function getCommandList() {
    return [
        mappingCommand, 
        menuCommand, 
        adminCommand, 
        getTiktokCommand() // Generate dynamic command
    ];
}