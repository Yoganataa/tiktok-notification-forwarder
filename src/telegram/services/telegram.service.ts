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
            this.logger.error('Invalid Core Group ID for Telegram', { error: e });
        }

        this.logger.info('✅ Telegram Service Connected');
    }

    async getOrCreateTopic(username: string): Promise<number> {
        const mapping = await this.mappingRepo.findByUsername(username);

        if (mapping && mapping.telegram_topic_id) {
            // Explicitly cast to Number to avoid type errors with some DB drivers
            return Number(mapping.telegram_topic_id);
        }

        try {
            if (!this.mainGroupId) throw new Error('Main Group ID not set');

            // Logic to create a forum topic
            const result = await this.client.invoke(
                new Api.channels.CreateForumTopic({
                    channel: this.mainGroupId,
                    title: `🎥 ${username}`,
                    iconColor: 0x6FB9F0
                })
            ) as Api.Updates;

            // Extract Topic ID from Updates
            // GramJS returns Updates object. We need to find UpdateChannelForumTopic
            const update = result.updates.find((u: any) => u.className === 'UpdateChannelForumTopic') as any;
            const topicId = update?.id || update?.topicId;

            if (!topicId) throw new Error('Failed to retrieve new Topic ID');

            // Save to DB
            await this.mappingRepo.updateTelegramTopic(username, topicId);

            this.logger.info(`Created Telegram Topic for ${username}: ${topicId}`);
            return Number(topicId);

        } catch (error) {
            this.logger.error('Failed to create Telegram topic', { error });
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
             this.logger.error('Failed to send video to Telegram', { error });
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
            this.logger.error('Failed to send message to Telegram', { error });
        }
    }
}
