import 'dotenv/config';
import '../container'; // Adjust path to container
import '../core/types/container.types';
import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { configManager } from '../core/config/config';
import { logger } from '../core/utils/logger';
import { container } from '@sapphire/framework';
import path from 'path';

export class DiscordClient extends SapphireClient {
    public constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction],
            loadMessageCommandListeners: true,
            defaultPrefix: '!',
            baseUserDirectory: __dirname, // Should point to src/discord/
        });
    }

    public override async login(token?: string): Promise<string> {
        // Assume DB and Config are loaded by main.ts before calling this

        try {
            const config = configManager.get();

            // Initialize Scheduler (Discord specific)
            container.services.scheduler.init(this);

            // Queue processing loop
            // Note: QueueService uses both Discord and Telegram clients.
            // We pass 'this' (Discord Client) to it.
            setInterval(() => container.services.queue.processQueue(this), 5000);

            logger.info('Logging in to Discord...');
            return super.login(token || config.discord.token);

        } catch (error) {
            logger.error('❌ Critical failure during Discord login', {
                error: (error as Error).message,
                stack: (error as Error).stack
            });
            process.exit(1);
        }
    }

    public override async destroy() {
        // DB disconnect handled in main or via signal handlers?
        // Original app.ts handled it. We should probably let main handle it or do it here.
        // But main.ts calls client.login() which keeps the process alive.
        // If client is destroyed, we might want to cleanup.
        return super.destroy();
    }
}
