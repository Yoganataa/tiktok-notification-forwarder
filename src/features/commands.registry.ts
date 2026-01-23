import { ModuleLoader } from '../core/services/module-loader.service';
import { BaseCommand } from '../core/contracts/module.contract';
import { logger } from '../shared/utils/logger';

export class CommandsRegistry {
    private commands: BaseCommand[] = [];

    async init() {
        if (this.commands.length > 0) return;
        this.commands = await ModuleLoader.loadModules<BaseCommand>('features/**/*.command.ts', BaseCommand);
        logger.info(`[CommandsRegistry] Discovered ${this.commands.length} commands.`);
    }

    getCommands() {
        return this.commands;
    }

    getDefinitions() {
        return this.commands.map(cmd => cmd.definition);
    }
}

export const commandRegistry = new CommandsRegistry();
