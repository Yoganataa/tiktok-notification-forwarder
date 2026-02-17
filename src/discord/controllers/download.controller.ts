import { ChatInputCommandInteraction, Message, AttachmentBuilder } from 'discord.js';
import { container } from '@sapphire/framework';
import { sendChunkedReply, sendChunkedMessage } from '../utils/discord-chunker';
import { logger } from '../../core/utils/logger';

export class DownloadController {
    /**
     * Handles the download logic for both Slash Commands and Message Listeners.
     * @param context The interaction or message triggering the download.
     * @param url The TikTok URL to download.
     */
    async handleDownloadRequest(context: ChatInputCommandInteraction | Message, url: string): Promise<void> {
        const isInteraction = context instanceof ChatInputCommandInteraction;

        try {
            // Initial Feedback
            if (isInteraction) {
                if (!context.deferred && !context.replied) await context.deferReply();
            } else {
                // For messages, maybe react or send a typing indicator?
                // Sending a typing indicator is good UX.
                await (context.channel as any).sendTyping();
            }

            const downloader = container.services.downloader;
            const result = await downloader.download(url);

            if (result) {
                const { buffer, buffers, type, urls } = result;
                const attachments: AttachmentBuilder[] = [];
                let tooLarge = false;

                // 1. Handle Slideshow (Multiple Buffers)
                if (type === 'image' && buffers && buffers.length > 0) {
                    for (let i = 0; i < buffers.length; i++) {
                        const buf = buffers[i];
                        if (buf.length > 25 * 1024 * 1024) { // 25MB limit
                            tooLarge = true;
                            break;
                        }
                        attachments.push(new AttachmentBuilder(buf, { name: `image_${i + 1}.png` }));
                    }
                }
                // 2. Handle Single File (Video/Image)
                else if (buffer) {
                    if (buffer.length > 25 * 1024 * 1024) {
                        tooLarge = true;
                    } else {
                        const ext = type === 'video' ? 'mp4' : 'png';
                        attachments.push(new AttachmentBuilder(buffer, { name: `tiktok.${ext}` }));
                    }
                } else {
                    tooLarge = true; // No buffer available
                }

                // 3. Send Response
                if (!tooLarge && attachments.length > 0) {
                    if (isInteraction) {
                        await sendChunkedReply(context as ChatInputCommandInteraction, 'Downloaded!', [], attachments);
                    } else {
                        // Use sendChunkedMessage for standard messages
                        await sendChunkedMessage((context as Message).channel, 'Downloaded!', [], attachments);
                    }
                } else {
                    const failContent = `Video too large or no buffer. Here are the links:\n${urls.join('\n')}`;
                    if (isInteraction) {
                        await (context as ChatInputCommandInteraction).editReply({ content: failContent });
                    } else {
                        await (context as Message).reply({ content: failContent });
                    }
                }

            } else {
                const failMsg = 'Failed to download video.';
                if (isInteraction) {
                    await (context as ChatInputCommandInteraction).editReply(failMsg);
                } else {
                    await (context as Message).reply(failMsg);
                }
            }
        } catch (error) {
            const errorMsg = `Error: ${(error as Error).message}`;
            logger.error(`Download failed: ${errorMsg}`);

            if (isInteraction) {
                const i = context as ChatInputCommandInteraction;
                if (i.deferred || i.replied) await i.editReply(errorMsg);
                else await i.reply({ content: errorMsg, ephemeral: true });
            } else {
                await (context as Message).reply(errorMsg);
            }
        }
    }
}
