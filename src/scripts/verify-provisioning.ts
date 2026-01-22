import { ForwarderService } from '../features/forwarder/forwarder.service';
import { configManager } from '../core/config/config';
import assert from 'assert';

// Mock Config
process.env.DISCORD_TOKEN = 'mock_token';
process.env.CLIENT_ID = 'mock_client_id';
process.env.OWNER_ID = 'mock_owner_id';
process.env.DATABASE_URL = 'sqlite://:memory:';
process.env.SOURCE_BOT_IDS = '123456789';
process.env.CORE_SERVER_ID = '987654321';
process.env.AUTO_CREATE_CATEGORY_ID = 'cat-id';
process.env.FALLBACK_CHANNEL_ID = 'fallback-id';
// Load config to ensure values are set
try { configManager.load(); } catch (e) { console.error('Config load failed:', e); }

// Mocks
const mockNotificationService = {
    extractNotification: (msg: any) => ({ username: msg._testUsername, url: 'http://url', type: 'video' }),
    addReaction: async () => {},
    getForwardConfig: async () => ({})
} as any;

const mockQueueService = {
    enqueue: async () => {}
} as any;

const mockUserMappingRepo = {
    findByUsername: async () => null, // Always return null to force provisioning
    upsert: async () => {}
} as any;

// Verification Logic
async function testSanitization(inputUsername: string, expectedChannelName: string | null) {
    console.log(`Testing: "${inputUsername}"...`);

    let createdChannelName: string | null = null;

    const mockClient = {
        guilds: {
            fetch: async () => ({
                channels: {
                    create: async (opts: any) => {
                        createdChannelName = opts.name;
                        return { id: 'new-id' };
                    }
                }
            })
        }
    } as any;

    const mockMessage = {
        author: { id: '123456789' }, // Matches config
        guildId: '987654321',
        client: mockClient,
        guild: { name: 'Core' },
        _testUsername: inputUsername // Hack to pass username to mock extractor
    } as any;

    const service = new ForwarderService(
        mockNotificationService,
        mockQueueService,
        mockUserMappingRepo
    );

    // We need to inject the mock logic for private method? No, we call public processMessage.
    // processMessage calls handleAutoProvisioning.

    await service.processMessage(mockMessage);

    if (expectedChannelName === 'Fallback') {
        // If fallback, no channel is created.
        assert.strictEqual(createdChannelName, null, `Expected no channel creation (Fallback), but got '${createdChannelName}'`);
    } else {
        assert.strictEqual(createdChannelName, expectedChannelName, `Expected channel name '${expectedChannelName}', got '${createdChannelName}'`);
    }
    console.log('✅ Passed');
}

async function run() {
    console.log('=== Starting Verification ===');

    // Input: User_Name.123 ➔ Assert Output: username
    await testSanitization('User_Name.123', 'username');

    // Input: 12345 ➔ Assert Output: Fallback
    await testSanitization('12345', 'Fallback');

    // Input: PureText ➔ Assert Output: puretext
    await testSanitization('PureText', 'puretext');

    console.log('=== All Tests Passed ===');
}

run().catch(e => console.error(e));
