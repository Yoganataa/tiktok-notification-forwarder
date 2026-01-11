
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
    // Use transaction for consistent read
    const existingMappings = await withTransaction(async (tx) => {
        return await this.mappingRepo.findByUsername(usernameVO, tx);
    });

    if (existingMappings.length > 0) {
        return existingMappings;
    }

    // 2. If not exists, proceed to Provisioning (Auto-Create)
    logger.info(`No mapping found for @${tiktokUser}. Provisioning new channel...`);

    // BUSINESS LOGIC: Sanitize channel name (Letters only, lowercase, no numbers/symbols)
    // Example: "User_Name.123" -> "username"
    const channelName = tiktokUser.replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (channelName.length < 2) {
        logger.warn(`Cannot auto-create channel. Username '${tiktokUser}' results in invalid channel name '${channelName}'.`);
        return []; // Cancel if channel name becomes invalid/empty
    }

    // 3. Call External API (Discord) - Done OUTSIDE DB transaction
    // Because we cannot rollback Discord channel creation if DB fails.
    let newChannelId: string;
    try {
        newChannelId = await this.channelManager.createChannel(channelName);
    } catch (error) {
        // If channel creation fails, stop process
        return [];
    }

    // 4. Save New Mapping to Database
    const newMapping = UserMapping.create(
        usernameVO,
        DiscordChannelId.create(newChannelId),
        null // No default role tag
    );

    await withTransaction(async (tx) => {
        await this.mappingRepo.save(newMapping, tx);
    });

    logger.info(`✅ Auto-provisioned: @${tiktokUser} -> #${channelName} (${newChannelId})`);
    
    return [newMapping];
  }
}
