
import { UserMapping } from '../../domain/entities/user-mapping.entity';
import { UserMappingRepository } from '../../domain/repositories/user-mapping.repository';
import { DiscordChannelManagerPort } from '../../ports/discord-channel-manager.port';
import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';
import { withTransaction } from '../../../../infra/database/transaction';
import { logger } from '../../../../infra/logger';

export class GetOrProvisionMappingUseCase {
  constructor(
    private readonly mappingRepo: UserMappingRepository,
    private readonly channelManager: DiscordChannelManagerPort
  ) {}

  async execute(tiktokUser: string): Promise<UserMapping[]> {
    const usernameVO = TikTokUsername.create(tiktokUser);

    // 1. Check if mapping already exists
    const existingMappings = await withTransaction(async (tx) => {
        return await this.mappingRepo.findByUsername(usernameVO, tx);
    });

    if (existingMappings.length > 0) {
        logger.debug(`Found existing mapping(s) for @${tiktokUser}`, { count: existingMappings.length });
        return existingMappings;
    }

    // 2. If not exists, proceed to Provisioning (Auto-Create)
    logger.info(`No mapping found for @${tiktokUser}. Provisioning new channel...`);

    // BUSINESS LOGIC: Sanitize channel name
    const channelName = tiktokUser.replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (channelName.length < 2) {
        logger.warn(`Cannot auto-create channel. Username '${tiktokUser}' results in invalid channel name '${channelName}'.`);
        return [];
    }

    // 3. Call External API (Discord)
    let newChannelId: string;
    try {
        newChannelId = await this.channelManager.createChannel(channelName);
        logger.debug(`Channel created via adapter`, { channelName, newChannelId });
    } catch (error) {
        logger.error(`Failed to provision channel for @${tiktokUser}`, { error: (error as Error).message });
        return [];
    }

    // 4. Save New Mapping to Database
    const newMapping = UserMapping.create(
        usernameVO,
        DiscordChannelId.create(newChannelId),
        null
    );

    await withTransaction(async (tx) => {
        await this.mappingRepo.save(newMapping, tx);
    });

    logger.info(`✅ Auto-provisioned: @${tiktokUser} -> #${channelName} (${newChannelId})`);
    
    return [newMapping];
  }
}
