import { Listener } from '@sapphire/framework';
import { Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { extractTikTokUrl } from '../../shared/utils/tiktok-validator';

export class MessageCreateListener extends Listener {
    public constructor(context: Listener.Context, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'messageCreate'
        });
    }

    public async run(message: Message) {
        // 1. Existing Forwarder Logic (Source Bots)
        try {
            await this.container.services.forwarder.processMessage(message);
        } catch (error) {
            // Forwarder errors handled internally
        }

        // 2. Smart Manual Download Logic
        try {
            // Priority Check 1: Bot Author (Fastest)
            if (message.author.bot) return;

            // Priority Check 2: Manual Mode Config (DB Lookup)
            const manualMode = await container.repos.systemConfig.get('MANUAL_DOWNLOAD_MODE');
            if (manualMode !== 'true') return;

            // Priority Check 3: Channel Whitelist (String check)
            const allowedChannelsStr = await container.repos.systemConfig.get('SMART_DOWNLOAD_CHANNELS');
            const allowedChannels = allowedChannelsStr ? allowedChannelsStr.split(',') : [];
            if (!allowedChannels.includes(message.channelId)) return;

            // Priority Check 4: URL Regex (Most Expensive)
            const url = extractTikTokUrl(message.content);
            if (!url) return;

            // Trigger Download
            await container.controllers.download.handleDownloadRequest(message, url);

        } catch (error) {
            // Silent failure for listener
        }
    }
}
