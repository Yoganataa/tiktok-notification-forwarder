import { UserMapping } from '../../domain/entities/user-mapping.entity';
import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';
import { UserMappingRepository } from '../../domain/repositories/user-mapping.repository';
import { withTransaction } from '../../../../infra/database/transaction';

export class ListMappingsUseCase {
  constructor(private readonly repo: UserMappingRepository) {}

  async getByChannel(channelIdStr: string): Promise<UserMapping[]> {
    const channelId = DiscordChannelId.create(channelIdStr);
    return await withTransaction(async (tx) => {
        return await this.repo.findByChannel(channelId, tx);
    });
  }

  async getByUsername(usernameStr: string): Promise<UserMapping[]> {
    const username = TikTokUsername.create(usernameStr);
    return await withTransaction(async (tx) => {
        return await this.repo.findByUsername(username, tx);
    });
  }

  async execute(page: number = 1, limit: number = 10): Promise<{ data: UserMapping[], total: number }> {
     return await withTransaction(async (tx) => {
        const offset = (page - 1) * limit;
        return await this.repo.list(limit, offset, tx);
    });
  }
}
