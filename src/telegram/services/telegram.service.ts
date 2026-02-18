import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Logger } from 'winston';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { loadTelegramSession } from '../../core/utils/telegram-session.store';

/**
 * TelegramService handles persistent MTProto user session operations.
 */
export class TelegramService {
    private client: TelegramClient | null = null;
    private mainGroupId: string | null = null; // Store as string, not bigint

    constructor(
        private logger: Logger,
        private mappingRepo: UserMappingRepository,
        private config: {
            apiId: number | null;
            apiHash: string | null;
            session: string | null;
            coreGroupId: string | null;
        }
    ) {}

    /**
     * Initialize Telegram client from stored session.
     */
    async init(): Promise<void> {
        if (this.client?.connected) {
            this.logger.warn('Telegram already initialized');
            return;
        }

        const fileSession = await loadTelegramSession();
        const finalSession = fileSession || this.config.session;

        if (!this.config.apiId || !this.config.apiHash || !finalSession || !this.config.coreGroupId) {
            this.logger.warn('Telegram credentials missing. Telegram service disabled.');
            return;
        }

        // Validate group ID but keep as string
        if (!/^-?\d+$/.test(this.config.coreGroupId)) {
            this.logger.error('Invalid Telegram coreGroupId format');
            return;
        }

        this.mainGroupId = this.config.coreGroupId;

        this.logger.info('Connecting to Telegram MTProto...');

        try {
            this.client = new TelegramClient(
                new StringSession(finalSession),
                this.config.apiId,
                this.config.apiHash,
                { connectionRetries: 5 }
            );

            await this.client.connect();

            const authorized = await this.client.checkAuthorization();

            if (!authorized) {
                this.logger.error('Telegram authorization failed');
                this.client = null;
                return;
            }

            this.logger.info('✅ Telegram Service Connected');

        } catch (e) {
            const err = e as Error;
            this.logger.error('Telegram initialization failed', { error: err.message });
            this.client = null;
        }
    }

    /**
     * Ensure Telegram client is usable.
     */
    private async ensureReady(): Promise<boolean> {
        if (!this.client || !this.mainGroupId) return false;

        try {
            return await this.client.checkAuthorization();
        } catch {
            return false;
        }
    }

    /**
     * Get or create forum topic for a username.
     */
    async getOrCreateTopic(username: string): Promise<string | null> {
        if (!(await this.ensureReady())) return null;

        const mapping = await this.mappingRepo.findByUsername(username);

        if (mapping?.telegram_topic_id) {
            return String(mapping.telegram_topic_id);
        }

        const targetTitle = `🎥 ${username}`;

        try {
            let offsetId = 0;
            let offsetDate = 0;
            let offsetTopic = 0;
            let foundTopicId: string | null = null;
            let hasMore = true;

            while (hasMore) {
                const topicsResult = await this.client!.invoke(
                    // @ts-ignore gramJS typing issue
                    new Api.channels.GetForumTopics({
                        channel: this.mainGroupId,
                        offsetDate,
                        offsetId,
                        offsetTopic,
                        limit: 100
                    })
                ) as any;

                if (!topicsResult?.topics?.length) break;

                const existing = topicsResult.topics.find(
                    (t: any) => t.title === targetTitle
                );

                if (existing) {
                    foundTopicId = String(existing.id);
                    break;
                }

                const last = topicsResult.topics.at(-1);
                if (last) offsetId = last.id;

                if (topicsResult.topics.length < 100) hasMore = false;
            }

            if (foundTopicId) {
                this.logger.info(`Found topic for ${username}: ${foundTopicId}`);
                await this.mappingRepo.updateTelegramTopic(username, foundTopicId);
                return foundTopicId;
            }

            const result = await this.client!.invoke(
                new Api.channels.CreateForumTopic({
                    channel: this.mainGroupId,
                    title: targetTitle,
                    iconColor: 0x6FB9F0
                })
            ) as Api.Updates;

            const update = result.updates.find(
                (u: any) => u.className === 'UpdateChannelForumTopic'
            ) as any;

            if (!update) {
                throw new Error('Topic creation update missing');
            }

            const topicId = String(update.id || update.topicId);

            await this.mappingRepo.updateTelegramTopic(username, topicId);

            this.logger.info(`Created topic for ${username}: ${topicId}`);
            return topicId;

        } catch (error) {
            const err = JSON.stringify(error, Object.getOwnPropertyNames(error));
            this.logger.error('Topic create/search failed', { error: err });
            return null;
        }
    }

    /**
     * Send video into a forum topic.
     */
    async sendVideo(topicId: string | number, buffer: Buffer, caption: string): Promise<void> {
        if (!(await this.ensureReady())) return;

        try {
            await this.client!.sendFile(this.mainGroupId!, {
                file: buffer,
                caption,
                replyTo: Number(topicId),
                forceDocument: false,
                supportsStreaming: true
            });
        } catch (error) {
            const err = JSON.stringify(error, Object.getOwnPropertyNames(error));
            this.logger.error('Failed to send video', { error: err });
        }
    }

    /**
     * Send text message into a forum topic.
     */
    async sendMessage(topicId: string | number, message: string): Promise<void> {
        if (!(await this.ensureReady())) return;

        try {
            await this.client!.sendMessage(this.mainGroupId!, {
                message,
                replyTo: Number(topicId)
            });
        } catch (error) {
            const err = JSON.stringify(error, Object.getOwnPropertyNames(error));
            this.logger.error('Failed to send message', { error: err });
        }
    }
}
