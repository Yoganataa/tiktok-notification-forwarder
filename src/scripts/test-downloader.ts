import { DownloaderService } from '../domain/downloader.service';
import { configManager } from '../infrastructure/config/config';

// Mock config load
process.env.DISCORD_TOKEN='mock_token';
process.env.CLIENT_ID='mock_client_id';
process.env.OWNER_ID='mock_owner_id';
process.env.DATABASE_URL='sqlite://:memory:';
try { configManager.load(); } catch (e) { console.error(e); }

// Mock SystemConfigRepository
const mockRepo = {
    get: async (key: string) => {
        if (key === 'DOWNLOAD_ENGINE') return 'tobyg74';
        return null;
    }
} as any;

const service = new DownloaderService(mockRepo);

async function test() {
    console.log('Testing Toby Engine...');
    try {
        const result = await service.download('https://www.tiktok.com/@tiktok/video/7106679573887061294');
        console.log('Result:', result);
    } catch (e) {
        console.error('Error:', (e as Error).message);
    }
}

test();
