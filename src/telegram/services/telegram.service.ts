import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Logger } from 'winston';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';

export class TelegramService {
    private client: TelegramClient;
    private mainGroupId: any = null; // BigInt or String

    constructor(
        private logger: Logger,
        private mappingRepo: UserMappingRepository,
        private config: { apiId: number; apiHash: string; botToken: string; coreGroupId: string }
    ) {
        this.client = new TelegramClient(
            new StringSession(""),
            config.apiId,
            config.apiHash,
            { connectionRetries: 5 }
        );
    }

    async init() {
        this.logger.info('Connecting to Telegram MTProto...');
        await this.client.start({
            botAuthToken: this.config.botToken,
        });

        try {
            this.mainGroupId = BigInt(this.config.coreGroupId);
        } catch (e) {
            this.logger.error('Invalid Core Group ID for Telegram', { error: (e as Error).message });
            throw new Error(`Invalid Core Group ID: ${this.config.coreGroupId}`);
        }

        this.logger.info('✅ Telegram Service Connected');
    }

    async getOrCreateTopic(username: string): Promise<string | null> {
        const mapping = await this.mappingRepo.findByUsername(username);

        // Return existing ID if present
        if (mapping && mapping.telegram_topic_id) {
            return String(mapping.telegram_topic_id);
        }

        if (!this.mainGroupId) {
             throw new Error("Main Group ID not initialized");
        }

        const targetTitle = `🎥 ${username}`;

        try {
            // 1. Pagination Search (Split-Brain Fix)
            let offsetId = 0;
            let offsetDate = 0;
            let offsetTopic = 0;
            let foundTopicId: string | null = null;
            let hasMore = true;

            // Loop through all topics
            while (hasMore) {
                // @ts-ignore - GramJS typing issues with Api.messages.ForumTopics vs Api.TypeForumTopics
                const topicsResult = await this.client.invoke(
                    new Api.channels.GetForumTopics({
                        channel: this.mainGroupId,
                        offsetDate: offsetDate,
                        offsetId: offsetId,
                        offsetTopic: offsetTopic,
                        limit: 100
                    })
                ) as any; // Using any to bypass strict type checking on return for now, as types are complex union

                if (!topicsResult || !topicsResult.topics || topicsResult.topics.length === 0) {
                    hasMore = false;
                    break;
                }

                // Check this batch
                const existingTopic = topicsResult.topics.find((t: any) => t.title === targetTitle);
                if (existingTopic) {
                    foundTopicId = String(existingTopic.id);
                    break;
                }

                // Prepare next page logic
                // GramJS pagination requires careful handling.
                // We usually just need to update offsetId/offsetTopic from the last item.
                const lastTopic = topicsResult.topics[topicsResult.topics.length - 1];
                if (lastTopic) {
                    offsetId = lastTopic.id;
                    // offsetTopic = lastTopic.id; // Sometimes redundant but depends on API specifics
                }

                if (topicsResult.topics.length < 100) {
                    hasMore = false;
                }
            }

            if (foundTopicId) {
                this.logger.info(`Found existing Telegram Topic for ${username}: ${foundTopicId}. Syncing DB...`);
                await this.mappingRepo.updateTelegramTopic(username, foundTopicId);
                return foundTopicId;
            }

            // 2. Create New Topic
            const result = await this.client.invoke(
                new Api.channels.CreateForumTopic({
                    channel: this.mainGroupId,
                    title: targetTitle,
                    iconColor: 0x6FB9F0
                })
            ) as Api.Updates;

            // 3. Robust Extraction
            // Find the specific update class
            // Check for UpdateChannelForumTopic
            const update = result.updates.find((u: any) => u.className === 'UpdateChannelForumTopic') as any;

            if (!update) {
                 // Try looking for generic update with topicId if specific class not found immediately?
                 // But className check is safest.
                 throw new Error("Failed to find UpdateChannelForumTopic in response");
            }

            const topicId = String(update.id || update.topicId);

            // Save to DB
            await this.mappingRepo.updateTelegramTopic(username, topicId);

            this.logger.info(`Created Telegram Topic for ${username}: ${topicId}`);
            return topicId;

        } catch (error) {
            // Improved Logging
            const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
            this.logger.error('Failed to get/create Telegram topic', { error: errorDetails });
            return null;
        }
    }

    async sendVideo(topicId: string | number, buffer: Buffer, caption: string) {
        if (!this.mainGroupId) throw new Error("Main Group ID not set");

        try {
            await this.client.sendFile(this.mainGroupId, {
                file: buffer,
                caption: caption,
                replyTo: parseInt(String(topicId)), // GramJS uses int for reply ID, safe for topic IDs < 2^53
                forceDocument: false,
                supportsStreaming: true,
            });
        } catch (error) {
             const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
             this.logger.error('Failed to send video to Telegram', { error: errorDetails });
        }
    }

    async sendMessage(topicId: string | number, message: string) {
        if (!this.mainGroupId) throw new Error("Main Group ID not set");
        try {
             await this.client.sendMessage(this.mainGroupId, {
                 message: message,
                 replyTo: parseInt(String(topicId))
             });
        } catch (error) {
            const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
            this.logger.error('Failed to send message to Telegram', { error: errorDetails });
        }
    }
}
