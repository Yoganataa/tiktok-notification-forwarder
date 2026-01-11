// src/interfaces/discord/client.ts
import { Client, GatewayIntentBits, ActivityType, Partials } from 'discord.js';
import { APP_VERSION } from '../../shared/constants';

export class DiscordClientWrapper {
  public readonly client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel], // Required for DM interactions if needed
      presence: {
        activities: [{ name: `TikTok notifications v${APP_VERSION}`, type: ActivityType.Watching }],
        status: 'online',
      },
    });
  }

  public async login(token: string): Promise<void> {
    await this.client.login(token);
  }

  public destroy(): void {
    this.client.destroy();
  }

  public async getChannel(id: string) {
    return this.client.channels.fetch(id);
  }
}
