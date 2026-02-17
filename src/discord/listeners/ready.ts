import { Listener } from '@sapphire/framework';
import { Client, Events, ActivityType } from 'discord.js';
import { logger } from '../../core/utils/logger';
import { configManager } from '../../core/config/config';

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

        if (!configManager.isConfigured) {
            logger.warn('⚠️ Bot is in SETUP MODE. Run /setup import to configure.');
            return;
        }

        // Dynamic Status
        const serverCount = client.guilds.cache.size;
        client.user?.setActivity(`${serverCount} Servers`, { type: ActivityType.Watching });

        await this.cleanGlobalCommands(client);
        await this.logServerInfo(client);
    }

    private async cleanGlobalCommands(client: Client): Promise<void> {
        try {
            logger.info('🧹 Cleaning global application commands...');
            await client.application?.commands.set([]);
            logger.info('✅ Global commands cleaned successfully.');
        } catch (error) {
            logger.error('❌ Failed to clean global commands', { error: (error as Error).message });
        }
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
