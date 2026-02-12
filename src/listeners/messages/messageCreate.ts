import { Listener } from '@sapphire/framework';
import { Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { validateUrl, extractTikTokUrl } from '../../services/engines/vette-lib/validator';

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
            // Prevent bot from triggering itself in Manual Mode
            if (message.author.bot) return;

            // Check if Manual Download Mode is enabled
            const manualMode = await container.repos.systemConfig.get('MANUAL_DOWNLOAD_MODE');
            if (manualMode !== 'true') return;

            // Check Allowed Channels
            const allowedChannelsStr = await container.repos.systemConfig.get('SMART_DOWNLOAD_CHANNELS');
            const allowedChannels = allowedChannelsStr ? allowedChannelsStr.split(',') : [];

            if (!allowedChannels.includes(message.channelId)) return;

            // Check and Extract URL
            const url = extractTikTokUrl(message.content);
            if (!url) return;

            // Trigger Download
            await container.controllers.download.handleDownloadRequest(message, url);

        } catch (error) {
            // Silent failure for listener
        }
    }
}
