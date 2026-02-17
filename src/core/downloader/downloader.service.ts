import { BaseDownloadEngine, DownloadResult } from '../contracts/download.contract';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { logger } from '../utils/logger';
import { detectPlatform } from '../utils/url-matcher';

// Engines
import {
    BlueskyEngine,
    CapCutEngine,
    DailymotionEngine,
    DevestAlphaEngine,
    DevestBetaEngine,
    DouyinEngine,
    FacebookInstaEngine,
    KuaishouEngine,
    LinkedInEngine,
    PinterestEngine,
    RedditEngine,
    SnapchatEngine,
    SoundCloudEngine,
    SpotifyEngine,
    TeraboxEngine,
    ThreadsEngine,
    TumblrEngine,
    TwitterEngine,
    YtDlpEngine,
    YouTubeEngine // Source A YouTube Engine
} from './engines';

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
     this.registerEngine(new BlueskyEngine());
     this.registerEngine(new CapCutEngine());
     this.registerEngine(new DailymotionEngine());
     this.registerEngine(new DouyinEngine());
     this.registerEngine(new FacebookInstaEngine());
     this.registerEngine(new KuaishouEngine());
     this.registerEngine(new LinkedInEngine());
     this.registerEngine(new PinterestEngine());
     this.registerEngine(new RedditEngine());
     this.registerEngine(new SnapchatEngine());
     this.registerEngine(new SoundCloudEngine());
     this.registerEngine(new SpotifyEngine());
     this.registerEngine(new TeraboxEngine());
     this.registerEngine(new ThreadsEngine());
     this.registerEngine(new TumblrEngine());
     this.registerEngine(new TwitterEngine());
     this.registerEngine(new YouTubeEngine()); // 'youtube'

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
    if (platform && platform !== 'tiktok') {
        // Special case for Douyin: it has its own engine but can also be handled by Devest/TikTok logic potentially.
        // Source A has dedicated Douyin controller/service.
        // If regex returns 'douyin', we use 'douyin' engine.

        let engineName = platform;

        // Map detected platform to engine name if necessary (usually 1:1)
        // Check if engine exists
        let engine = this.engines.get(engineName);

        // Fallback for 'instagram'/'facebook' regex to 'facebook-insta' engine
        if (!engine && (platform === 'instagram' || platform === 'facebook')) {
             engine = this.engines.get('facebook-insta');
        }

        if (engine) {
            logger.info(`[DownloaderService] Routing to dedicated engine: ${engine.name}`);
            return await engine.download(url);
        } else {
             // If platform detected but no engine, maybe fallback to generic ytdlp if registered?
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
