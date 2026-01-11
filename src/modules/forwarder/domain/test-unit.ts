import { AddMappingUseCase } from '../application/usecases/add-mapping.usecase';
import { UserMappingRepository } from './repositories/user-mapping.repository';
import { TransactionContext } from '../../../infra/database/transaction';
import { UserMapping } from './entities/user-mapping.entity';
import { TikTokUsername } from './value-objects/tiktok-username.vo';
import { DiscordChannelId } from './value-objects/discord-channel-id.vo';

// Mock Repository
class MockRepo implements UserMappingRepository {
  public saved: UserMapping[] = [];
  
  async save(mapping: UserMapping, _tx: TransactionContext): Promise<void> {
    this.saved.push(mapping);
  }
  
  async remove(_username: TikTokUsername, _channelId: DiscordChannelId, _tx: TransactionContext): Promise<boolean> {
    return true;
  }
  
  async findByUsername(_username: TikTokUsername, _tx: TransactionContext): Promise<UserMapping[]> {
    return [];
  }
  
  async findByChannel(_channelId: DiscordChannelId, _tx: TransactionContext): Promise<UserMapping[]> {
    return [];
  }
  async findAll(_tx: TransactionContext): Promise<UserMapping[]> {
    return [];
  }
  async list(_limit: number, _offset: number, _tx: TransactionContext): Promise<{ data: UserMapping[], total: number }> {
    return { data: [], total: 0 };
  }
}

async function test() {
  console.log("Running AddMappingUseCase Test...");
  const repo = new MockRepo();
  const useCase = new AddMappingUseCase(repo);

  try {
    await useCase.execute({
      username: "@TestUser",
      channelId: "123456789012345678",
      roleId: "role123"
    });

    if (repo.saved.length !== 1) throw new Error("Should rely on repository save");
    const saved = repo.saved[0];
    
    if (saved.username.value !== "testuser") throw new Error("Username normalization failed");
    if (saved.channelId.value !== "123456789012345678") throw new Error("Channel ID check failed");
    
    console.log("✅ Success: UseCase created and saved valid aggregate");
  } catch (e) {
    console.error("❌ Failed:", e);
    process.exit(1);
  }
}

test();
