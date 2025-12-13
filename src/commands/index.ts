// src/commands/index.ts
import { mappingCommand } from './mapping';
import { menuCommand } from './menu'; 
import { adminCommand } from './admin'; 
export const commandList = [
  mappingCommand,
  menuCommand,
  adminCommand
];