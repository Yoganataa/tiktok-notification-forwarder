
import { TiktokDownloadService } from '../../../tiktok/application/tiktok.service';
import { GetOrProvisionMappingUseCase } from './get-or-provision-mapping.usecase';
import { TikTokVideoForwardedEvent } from '../../domain/events/tiktok-video-forwarded.event';
import { ForwarderLogger } from '../../ports/logger.port';
import { DownloadResult } from '../../../tiktok/domain';
import { withTransaction } from '../../../../infra/database/transaction';
import { OutboxRepository } from '../../../../shared/infra/outbox/outbox.repository';

export class ProcessTiktokLinkUseCase {
  constructor(
    private readonly tiktokService: TiktokDownloadService,
    private readonly provisioningUseCase: GetOrProvisionMappingUseCase,
    private readonly outboxRepo: OutboxRepository,
    private readonly logger: ForwarderLogger
  ) {}

  async execute(url: string, sourceUserTag: string): Promise<boolean> {
    this.logger.info(`Processing URL: ${url} from ${sourceUserTag}`);
    
    // 1. Download info media
    const media: DownloadResult | null = await this.tiktokService.download(url);
    if (!media || !media.author) {
        this.logger.warn('Failed to download media or extract author.');
        return false;
    }

    // 2. Get Mapping (Find Existing OR Provision New)
    // "Auto Create" logic is encapsulated in provisioningUseCase
    const mappings = await this.provisioningUseCase.execute(media.author);

    if (mappings.length === 0) {
        // If empty return, it means no mapping AND auto-create failed (e.g. invalid name)
        this.logger.info(`No mappings available for @${media.author} (Auto-create skipped/failed)`);
        return true; 
    }

    // 3. Save Events to Outbox
    this.logger.info(`Processing ${mappings.length} mappings for @${media.author}...`);
    
    // Use transaction only for saving events to Outbox
    return await withTransaction(async (tx) => {
        for (const mapping of mappings) {
            const event = new TikTokVideoForwardedEvent({
                username: mapping.username.value,
                channelId: mapping.channelId.value,
                roleIdToTag: mapping.roleIdToTag
            }, media, url);
            
            await this.outboxRepo.save(event, tx);
        }
        return true;
    });
  }
}
