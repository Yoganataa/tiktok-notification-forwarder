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
        private config: { apiId: number | null; apiHash: string | null; session: string | null; coreGroupId: string | null }
    ) {
        // Initialize with session if present, or empty. The check happens in init().
        this.client = new TelegramClient(
            new StringSession(config.session || ""),
            config.apiId || 0,
            config.apiHash || "",
            { connectionRetries: 5 }
        );
    }

    async init() {
        if (!this.config.apiId || !this.config.apiHash || !this.config.session || !this.config.coreGroupId) {
            this.logger.warn('Telegram credentials missing. Telegram service functionality will be disabled.');
            return;
        }

        this.logger.info('Connecting to Telegram MTProto...');

        try {
            // Connect using the provided session string (User Client)
            await this.client.connect();

            this.mainGroupId = BigInt(this.config.coreGroupId);

            if (await this.client.checkAuthorization()) {
                this.logger.info('✅ Telegram Service Connected (User Session)');
            } else {
                this.logger.error('❌ Telegram Authorization Failed. Please check the session string.');
                // Don't throw here to avoid crashing the whole bot, just functionality disabled
            }
        } catch (e) {
             this.logger.error('Telegram Service initialization failed', { error: (e as Error).message });
        }
    }

    async getOrCreateTopic(username: string): Promise<string | null> {
        // If not initialized properly, fail fast
        if (!this.mainGroupId || !this.client.connected) {
             // Optionally log debug here
             return null;
        }

        const mapping = await this.mappingRepo.findByUsername(username);

        // Return existing ID if present
        if (mapping && mapping.telegram_topic_id) {
            return String(mapping.telegram_topic_id);
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
                ) as any;

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
                const lastTopic = topicsResult.topics[topicsResult.topics.length - 1];
                if (lastTopic) {
                    offsetId = lastTopic.id;
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
            const update = result.updates.find((u: any) => u.className === 'UpdateChannelForumTopic') as any;

            if (!update) {
                 throw new Error("Failed to find UpdateChannelForumTopic in response");
            }

            const topicId = String(update.id || update.topicId);

            // Save to DB
            await this.mappingRepo.updateTelegramTopic(username, topicId);

            this.logger.info(`Created Telegram Topic for ${username}: ${topicId}`);
            return topicId;

        } catch (error) {
            const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
            this.logger.error('Failed to get/create Telegram topic', { error: errorDetails });
            return null;
        }
    }

    async sendVideo(topicId: string | number, buffer: Buffer, caption: string) {
        if (!this.mainGroupId || !this.client.connected) return;

        try {
            await this.client.sendFile(this.mainGroupId, {
                file: buffer,
                caption: caption,
                replyTo: parseInt(String(topicId)),
                forceDocument: false,
                supportsStreaming: true,
            });
        } catch (error) {
             const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
             this.logger.error('Failed to send video to Telegram', { error: errorDetails });
        }
    }

    async sendMessage(topicId: string | number, message: string) {
        if (!this.mainGroupId || !this.client.connected) return;
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
