import { Listener } from '@sapphire/framework';
import { Message } from 'discord.js';

export class MessageCreateListener extends Listener {
    public constructor(context: Listener.Context, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'messageCreate'
        });
    }

    public async run(message: Message) {
        // Prevent bot from triggering itself (Sapphire has guards for this, but explicit is safe)
        if (message.author.id === this.container.client.id) return;

        try {
            await this.container.services.forwarder.processMessage(message);
        } catch (error) {
            // Logger is already used inside service, but we catch here to prevent crash
        }
    }
}
