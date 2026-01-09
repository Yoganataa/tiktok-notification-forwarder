// scripts/samplett.ts

// Pastikan ts-node terinstall untuk menjalankan ini:
// npx ts-node scripts/samplett.ts

import { configManager } from '../src/core/config/config';
import { TiktokDownloadService } from '../src/services/tiktok-download.service';

async function runSample() {
    console.log("=========================================");
    console.log("   TIKTOK SAMPLE SCRIPT (TOBYG74)");
    console.log("=========================================\n");

    // 1. Initialize Configuration
    // Ini akan membaca file .env secara otomatis
    const config = configManager.load();

    // 2. Force Engine to 'tobyg74' untuk testing script ini
    // (Override settingan default/db hanya untuk sesi script ini)
    config.bot.downloaderEngine = 'tobyg74';
    
    console.log(`[Config] Engine Active : ${config.bot.downloaderEngine.toUpperCase()}`);
    console.log(`[Config] Cookie Loaded : ${config.bot.tiktokCookie ? 'Yes (Ready to Search)' : 'No (Search might fail)'}`);

    if (!config.bot.tiktokCookie) {
        console.warn("⚠️  WARNING: TIKTOK_COOKIE kosong di .env! Fitur Search memerlukan cookie valid.");
    }

    // 3. Instantiate Service
    const tiktokService = new TiktokDownloadService();

    // ---------------------------------------------------------
    // TEST 1: DOWNLOAD
    // ---------------------------------------------------------
    console.log("\n--- [1] Testing Download ---");
    // URL Sample (Official TikTok Account Video)
    const targetUrl = 'https://www.tiktok.com/@pop_nrt/video/7592583451929644309?is_from_webapp=1&sender_device=pc'; 
    console.log(`Target URL: ${targetUrl}`);

    try {
        const startDl = Date.now();
        const downloadResult = await tiktokService.download(targetUrl);
        const endDl = Date.now();

        if (downloadResult) {
            console.log(`✅ Download Success (${endDl - startDl}ms)`);
            console.log("Type:", downloadResult.type);
            console.log("Author:", downloadResult.author);
            console.log("Description:", downloadResult.description?.substring(0, 50) + "...");
            console.log("URLs Found:", downloadResult.urls.length);
            console.log("First URL:", downloadResult.urls[0]);
        } else {
            console.error("❌ Download Failed (Result is null). Engine might be blocking request.");
        }
    } catch (error) {
        console.error("❌ Download Error:", (error as Error).message);
    }

    // ---------------------------------------------------------
    // TEST 2: SEARCH (Requires Cookie)
    // ---------------------------------------------------------
    console.log("\n--- [2] Testing Search ---");
    const query = 'coding setup';
    const type = 'video';
    
    console.log(`Query: "${query}" | Type: ${type}`);

    try {
        const startSearch = Date.now();
        const searchResult = await tiktokService.search(query, type);
        const endSearch = Date.now();

        if (searchResult.length > 0) {
            console.log(`✅ Search Success (${endSearch - startSearch}ms)`);
            console.log(`Found ${searchResult.length} items.`);
            
            // Tampilkan 2 hasil pertama
            const top2 = searchResult.slice(0, 2);
            top2.forEach((item: any, i: number) => {
                console.log(`\n   [Result #${i + 1}]`);
                console.log(`   - Desc: ${item.desc || item.title || 'No Desc'}`);
                console.log(`   - Author: ${item.author?.nickname || item.nickname}`);
                console.log(`   - ID: ${item.id || item.uid}`);
            });
        } else {
            console.log("❌ No results found.");
            if (!config.bot.tiktokCookie) {
                console.log("   -> Kemungkinan besar karena COOKIE tidak diset di .env");
            }
        }
    } catch (error) {
        console.error("❌ Search Error:", (error as Error).message);
    }

    console.log("\n=========================================");
    console.log("   END OF SCRIPT");
    console.log("=========================================");
}

// Jalankan fungsi utama
runSample();