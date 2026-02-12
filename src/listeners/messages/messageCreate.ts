import { Listener } from '@sapphire/framework';
import { Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { validateUrl } from '../../services/engines/vette-lib/validator';
import { DownloadController } from '../../controllers/download.controller';

export class MessageCreateListener extends Listener {
    private downloadController = new DownloadController();

    public constructor(context: Listener.Context, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'messageCreate'
        });
    }

    public async run(message: Message) {
        // Prevent bot from triggering itself
        if (message.author.bot) return;

        // 1. Existing Forwarder Logic (Source Bots)
        try {
            await this.container.services.forwarder.processMessage(message);
        } catch (error) {
            // Forwarder errors handled internally
        }

        // 2. Smart Manual Download Logic
        try {
            // Check if Manual Download Mode is enabled
            const manualMode = await container.repos.systemConfig.get('MANUAL_DOWNLOAD_MODE');
            if (manualMode !== 'true') return;

            // Check if URL is valid TikTok URL
            if (!validateUrl(message.content)) return;

            // Check Allowed Channels
            const allowedChannelsStr = await container.repos.systemConfig.get('SMART_DOWNLOAD_CHANNELS');
            const allowedChannels = allowedChannelsStr ? allowedChannelsStr.split(',') : [];

            if (!allowedChannels.includes(message.channelId)) return;

            // Trigger Download
            await this.downloadController.handleDownloadRequest(message, message.content);

        } catch (error) {
            // Silent failure for listener
        }
    }
}
