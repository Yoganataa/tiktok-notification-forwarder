import { UserMapping } from '../../domain/entities/user-mapping.entity';
import { TikTokUsername } from '../../domain/value-objects/tiktok-username.vo';
import { DiscordChannelId } from '../../domain/value-objects/discord-channel-id.vo';
import { UserMappingRepository } from '../../domain/repositories/user-mapping.repository';
import { withTransaction } from '../../../../infra/database/transaction';

export class AddMappingUseCase {
  constructor(private readonly repo: UserMappingRepository) {}

  async execute(input: {
    username: string;
    channelId: string;
    roleId?: string;
  }): Promise<void> {
    const username = TikTokUsername.create(input.username);
    const channelId = DiscordChannelId.create(input.channelId);

    const mapping = UserMapping.create(
      username,
      channelId,
      input.roleId ?? null
    );

    await withTransaction(async (tx) => {
        await this.repo.save(mapping, tx);
    });
  }
}
