import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Logger } from 'winston';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';

export class TelegramService {
    private client: TelegramClient;
    private mainGroupId: any = null; // Using any to support BigInt/BigInteger compatibility

    constructor(
        private logger: Logger,
        private mappingRepo: UserMappingRepository,
        private config: { apiId: number; apiHash: string; botToken: string; coreGroupId: string }
    ) {
        this.client = new TelegramClient(
            new StringSession(""), // Bot tokens don't strictly need string sessions for auth
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

        // Handle BigInt conversion safely
        try {
            this.mainGroupId = BigInt(this.config.coreGroupId);
        } catch (e) {
            this.logger.error('Invalid Core Group ID for Telegram', { error: (e as Error).message });
        }

        this.logger.info('✅ Telegram Service Connected');
    }

    async getOrCreateTopic(username: string): Promise<number> {
        const mapping = await this.mappingRepo.findByUsername(username);

        if (mapping && mapping.telegram_topic_id) {
            // Explicitly cast to Number to avoid type errors with some DB drivers
            return Number(mapping.telegram_topic_id);
        }

        if (!this.mainGroupId) {
             this.logger.error('Main Group ID not set for Telegram Service');
             return 0;
        }

        const targetTitle = `🎥 ${username}`;

        try {
            // 1. Check if topic already exists in Telegram (Split-brain fix)
            // We search through existing topics first.

            // Using Api.channels.GetForumTopics
            const topicsResult = await this.client.invoke(
                new Api.channels.GetForumTopics({
                    channel: this.mainGroupId,
                    offsetDate: 0,
                    offsetId: 0,
                    offsetTopic: 0,
                    limit: 100, // Fetch up to 100 recent topics
                    q: username // Try to filter by username directly if supported
                })
            ) as Api.messages.ForumTopics; // Correct return type for channels.GetForumTopics is messages.ForumTopics

            if (topicsResult && topicsResult.topics) {
                const existingTopic = topicsResult.topics.find((t: any) => t.title === targetTitle);

                if (existingTopic) {
                    const foundId = existingTopic.id;
                    this.logger.info(`Found existing Telegram Topic for ${username}: ${foundId}. Syncing DB...`);

                    // Sync DB
                    await this.mappingRepo.updateTelegramTopic(username, foundId);
                    return Number(foundId);
                }
            }

            // 2. If not found, create new topic
            const result = await this.client.invoke(
                new Api.channels.CreateForumTopic({
                    channel: this.mainGroupId,
                    title: targetTitle,
                    iconColor: 0x6FB9F0
                })
            ) as Api.Updates;

            // Extract Topic ID from Updates
            // GramJS returns Updates object. We need to find UpdateChannelForumTopic
            const update = result.updates.find((u: any) => u.className === 'UpdateChannelForumTopic') as any;
            const topicId = update?.id || update?.topicId;

            if (!topicId) throw new Error('Failed to retrieve new Topic ID from Telegram response');

            // Save to DB
            await this.mappingRepo.updateTelegramTopic(username, topicId);

            this.logger.info(`Created Telegram Topic for ${username}: ${topicId}`);
            return Number(topicId);

        } catch (error) {
            const errorMsg = (error as Error).message || JSON.stringify(error);
            this.logger.error('Failed to get/create Telegram topic', { error: errorMsg });
            return 0; // 0 = General Topic fallback or error
        }
    }

    async sendVideo(topicId: number, buffer: Buffer, caption: string) {
        if (!this.mainGroupId) return;

        try {
            await this.client.sendFile(this.mainGroupId, {
                file: buffer,
                caption: caption,
                replyTo: topicId, // Sends into the specific topic
                forceDocument: false,
                supportsStreaming: true,
            });
        } catch (error) {
             const errorMsg = (error as Error).message || JSON.stringify(error);
             this.logger.error('Failed to send video to Telegram', { error: errorMsg });
        }
    }

    async sendMessage(topicId: number, message: string) {
        if (!this.mainGroupId) return;
        try {
             await this.client.sendMessage(this.mainGroupId, {
                 message: message,
                 replyTo: topicId
             });
        } catch (error) {
            const errorMsg = (error as Error).message || JSON.stringify(error);
            this.logger.error('Failed to send message to Telegram', { error: errorMsg });
        }
    }
}
