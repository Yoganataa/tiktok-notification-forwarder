import { Listener } from '@sapphire/framework';
import { Client, Events } from 'discord.js';
import { logger } from '../../shared/utils/logger';
import { configManager } from '../../infrastructure/config/config';

export class ReadyListener extends Listener {
    public constructor(context: Listener.Context, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.ClientReady,
            once: true
        });
    }

    public async run(client: Client) {
        const { username, id } = client.user!;
        logger.info(`✅ Bot authenticated as ${username} (${id})`);

        await this.logServerInfo(client);
    }

    private async logServerInfo(client: Client): Promise<void> {
        try {
            const guilds = await client.guilds.fetch();
            const config = configManager.get();

            logger.info(`Guild Access: Active in ${guilds.size} servers`);

            for (const [id, guild] of guilds) {
                const isCore = id === config.discord.coreServerId;
                logger.info(`- ${guild.name} (${id}) | Core: ${isCore}`);
            }
        } catch (error) {
            logger.warn('Could not fetch guild list');
        }
    }
}
