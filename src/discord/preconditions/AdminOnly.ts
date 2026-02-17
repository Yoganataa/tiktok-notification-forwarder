import { Precondition } from '@sapphire/framework';
import { ChatInputCommandInteraction } from 'discord.js';

export class AdminOnlyPrecondition extends Precondition {
    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const isAdmin = await this.container.services.permission.isAdminOrHigher(interaction.user.id);

        return isAdmin
            ? this.ok()
            : this.error({ message: '⛔ Only Admins can use this command.' });
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        AdminOnly: never;
    }
}
