import { Precondition } from '@sapphire/framework';
import { ChatInputCommandInteraction } from 'discord.js';
import { configManager } from '../core/config/config';

export class CoreServerOnlyPrecondition extends Precondition {
    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const config = configManager.get();
        if (interaction.guildId !== config.discord.coreServerId) {
             return this.error({ message: '⛔ This command is only available in the Core Server.' });
        }
        return this.ok();
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        CoreServerOnly: never;
    }
}
