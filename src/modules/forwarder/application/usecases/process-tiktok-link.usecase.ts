import { TiktokDownloadService } from '../../../tiktok/application/tiktok.service';
import { GetOrProvisionMappingUseCase } from './get-or-provision-mapping.usecase';
import { TikTokVideoForwardedEvent } from '../../domain/events/tiktok-video-forwarded.event';
import { ForwarderLogger } from '../../ports/logger.port';
import { DownloadResult } from '../../../tiktok/domain';
import { withTransaction } from '../../../../infra/database/transaction';
import { OutboxRepository } from '../../../../shared/infra/outbox/outbox.repository';
import { configManager } from '../../../../infra/config/config';
import { UserMapping } from '../../domain/entities/user-mapping.entity';
import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';

export class ProcessTiktokLinkUseCase {
  constructor(
    private readonly tiktokService: TiktokDownloadService,
    private readonly provisioningUseCase: GetOrProvisionMappingUseCase,
    private readonly outboxRepo: OutboxRepository,
    private readonly logger: ForwarderLogger
  ) {}

  async execute(url: string, sourceUserTag: string, sourceGuildName?: string): Promise<boolean> {
    this.logger.info(`Processing URL: ${url} from ${sourceUserTag} (Guild: ${sourceGuildName || 'Direct'})`);
    
    // 1. Download info media
    const media: DownloadResult | null = await this.tiktokService.download(url);
    if (!media || !media.author) {
        this.logger.warn('Failed to download media or extract author.');
        return false;
    }

    // 2. Get Mapping (Find Existing OR Provision New)
    let mappings = await this.provisioningUseCase.execute(media.author);

    // --- FALLBACK LOGIC ---
    if (mappings.length === 0) {
        const fallbackId = configManager.get().bot.fallbackChannelId;
        if (fallbackId && fallbackId !== '0') {
            this.logger.info(`No specific mapping found for @${media.author}. Using Fallback Channel: ${fallbackId}`);
            // Create a valid UserMapping object
            // We use the author name as the username, and the fallback channel ID.
            const fallbackMapping = UserMapping.create(
                TikTokUsername.create(media.author),
                DiscordChannelId.create(fallbackId),
                null
            );
            mappings = [fallbackMapping];
        } else {
             this.logger.info(`No mappings available for @${media.author} and no fallback channel configured.`);
             return true;
        }
    }

    // 3. Save Events to Outbox
    this.logger.info(`Processing ${mappings.length} mappings for @${media.author}...`);
    
    return await withTransaction(async (tx) => {
        for (const mapping of mappings) {
            const event = new TikTokVideoForwardedEvent(
                {
                    username: mapping.username.value,
                    channelId: mapping.channelId.value,
                    roleIdToTag: mapping.roleIdToTag
                },
                media,
                url,
                sourceGuildName
            );
            
            await this.outboxRepo.save(event, tx);
        }
        return true;
    });
  }
}
