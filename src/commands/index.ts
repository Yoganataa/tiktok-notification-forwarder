// src/commands/index.ts
import { mappingCommand } from './mapping.command';
import { menuCommand } from './menu.command';
import { adminCommand } from './admin.command';

export const commandList = [mappingCommand, menuCommand, adminCommand];