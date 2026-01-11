import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';
import { UserMappingRepository } from '../../domain/repositories/user-mapping.repository';
import { withTransaction } from '../../../../infra/database/transaction';

export class RemoveMappingUseCase {
  constructor(private readonly repo: UserMappingRepository) {}

  async execute(input: {
    username: string;
    channelId: string;
    roleId?: string;
  }): Promise<boolean> {
    const username = TikTokUsername.create(input.username);
    const channelId = DiscordChannelId.create(input.channelId);

    return await withTransaction(async (tx) => {
        return await this.repo.remove(username, channelId, tx);
    });
  }
}
