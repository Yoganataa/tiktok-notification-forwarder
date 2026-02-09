import { Precondition } from '@sapphire/framework';
import { ChatInputCommandInteraction } from 'discord.js';

export class SudoOnlyPrecondition extends Precondition {
    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const isSudo = await this.container.services.permission.isSudoOrHigher(interaction.user.id);

        return isSudo
            ? this.ok()
            : this.error({ message: '⛔ Permission denied. Sudo access required.' });
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        SudoOnly: never;
    }
}
