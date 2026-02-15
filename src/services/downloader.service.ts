import { BaseDownloadEngine, DownloadResult } from '../core/contracts/download.contract';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { logger } from '../shared/utils/logger';
import { detectPlatform } from '../shared/utils/url-matcher';

// Engines
import YtDlpEngine from './engines/ytdlp.engine';
import DevestAlphaEngine from './engines/devest-alpha.engine';
import DevestBetaEngine from './engines/devest-beta.engine';
import TwitterEngine from './engines/twitter.engine';
import RedditEngine from './engines/reddit.engine';

export class DownloaderService {
  private engines: Map<string, BaseDownloadEngine> = new Map();

  constructor(private configRepo: SystemConfigRepository) {}

  async init() {
     if (this.engines.size > 0) return;

     // TikTok Engines
     this.registerEngine(new DevestAlphaEngine()); // 'devest-alpha'
     this.registerEngine(new DevestBetaEngine());  // 'devest-beta'
     this.registerEngine(new YtDlpEngine());       // 'ytdlp'

     // Other Platforms
     this.registerEngine(new TwitterEngine());
     this.registerEngine(new RedditEngine());

     logger.info(`[DownloaderService] Initialized with ${this.engines.size} engines.`);
  }

  registerEngine(engine: BaseDownloadEngine) {
    this.engines.set(engine.name, engine);
  }

  /**
   * Returns a list of all registered engine names.
   */
  getRegisteredEngineNames(): string[] {
      return Array.from(this.engines.keys());
  }

  async download(url: string): Promise<DownloadResult> {
    const platform = detectPlatform(url);
    logger.info(`[DownloaderService] Detected platform: ${platform || 'Unknown'}`);

    // --- NON-TIKTOK ROUTING ---
    if (platform && platform !== 'tiktok' && platform !== 'douyin') {
        const engine = this.engines.get(platform);
        if (engine) {
            logger.info(`[DownloaderService] Routing to dedicated engine: ${platform}`);
            return await engine.download(url);
        } else {
             // If platform detected but no engine, maybe fallback to generic ytdlp if registered?
             // For now, per instruction: "This engine does not need to appear in the /menu configuration."
             // If we don't have a specific class (like instagram), we might want to try ytdlp as a catch-all if configured?
             // But instruction says: "If the URL matches another platform... directly use the appropriate engine."
             // If no engine found, fall through to error or generic handling.

             // Check if YtDlp supports it generically?
             const ytdlp = this.engines.get('ytdlp');
             if (ytdlp) {
                 logger.info(`[DownloaderService] No dedicated engine for ${platform}, trying generic yt-dlp.`);
                 return await ytdlp.download(url);
             }

             throw new Error(`No engine available for platform: ${platform}`);
        }
    }

    // --- TIKTOK ROUTING (Primary -> Fallback 1 -> Fallback 2) ---
    // 1. Load configuration
    // Default to 'devest-alpha' (renamed from devest) if not set.
    // Note: Database might still have 'devest' or 'vette' if not migrated.
    // We should map 'devest' -> 'devest-alpha' for backward compatibility in config.
    let primaryEngineName = await this.configRepo.get('DOWNLOAD_ENGINE') || 'devest-alpha';
    let fallback1 = await this.configRepo.get('DOWNLOAD_ENGINE_FALLBACK_1') || 'none';
    let fallback2 = await this.configRepo.get('DOWNLOAD_ENGINE_FALLBACK_2') || 'none';

    // Config Migration / Mapping on the fly
    if (primaryEngineName === 'devest') primaryEngineName = 'devest-alpha';
    if (fallback1 === 'devest') fallback1 = 'devest-alpha';
    if (fallback2 === 'devest') fallback2 = 'devest-alpha';

    // 2. Construct execution list
    const executionList = [primaryEngineName, fallback1, fallback2]
        .filter(name => name && name !== 'none')
        .filter((name, index, self) => self.indexOf(name) === index); // Unique

    let lastError: Error | null = null;

    // 3. Iterate through execution list
    for (const engineName of executionList) {
        const engine = this.engines.get(engineName);

        if (!engine) {
            logger.warn(`Engine ${engineName} not found, skipping...`);
            continue;
        }

        try {
            logger.info(`Attempting TikTok download using engine: ${engineName}`);
            const result = await engine.download(url);
            return result;
        } catch (error) {
            lastError = error as Error;
            logger.warn(`Engine ${engineName} failed: ${(error as Error).message}. Switching to next fallback...`);
        }
    }

    // 4. If all failed
    throw new Error(`All configured download engines failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}
