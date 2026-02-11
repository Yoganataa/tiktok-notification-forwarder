import { BaseDownloadEngine, DownloadResult } from '../core/contracts/download.contract';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { logger } from '../shared/utils/logger';
import HansEngine from './engines/hans.engine';
import VetteEngine from './engines/vette.engine';
import BtchEngine from './engines/btch.engine';
import YtDlpEngine from './engines/ytdlp.engine';
import DevestEngine from './engines/devest.engine';

export class DownloaderService {
  private engines: Map<string, BaseDownloadEngine> = new Map();

  constructor(private configRepo: SystemConfigRepository) {}

  async init() {
     if (this.engines.size > 0) return;

     this.registerEngine(new VetteEngine());
     this.registerEngine(new HansEngine());
     this.registerEngine(new BtchEngine());
     this.registerEngine(new YtDlpEngine());
     this.registerEngine(new DevestEngine());

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
    // 1. Load configuration for Primary, Fallback 1, and Fallback 2
    const primaryEngineName = await this.configRepo.get('DOWNLOAD_ENGINE') || 'vette';
    const fallback1 = await this.configRepo.get('DOWNLOAD_ENGINE_FALLBACK_1') || 'none';
    const fallback2 = await this.configRepo.get('DOWNLOAD_ENGINE_FALLBACK_2') || 'none';

    // 2. Construct execution list, filtering 'none' and duplicates
    const executionList = [primaryEngineName, fallback1, fallback2]
        .filter(name => name && name !== 'none')
        .filter((name, index, self) => self.indexOf(name) === index); // Unique only

    let lastError: Error | null = null;

    // 3. Iterate through execution list
    for (const engineConfig of executionList) {
        let engineName = engineConfig;
        let subType = '';

        if (engineName.includes(':')) {
            [engineName, subType] = engineName.split(':');
        }

        const engine = this.engines.get(engineName);

        if (!engine) {
            logger.warn(`Engine ${engineName} not found, skipping...`);
            continue;
        }

        // Configure subtype if applicable (e.g. for Hans engine or Devest engine)
        if (engine instanceof HansEngine && subType) {
            (engine as HansEngine).setProvider(subType);
        } else if (engine instanceof DevestEngine && subType) {
            (engine as DevestEngine).setMode(subType);
        }

        try {
            logger.info(`Attempting download using engine: ${engineName}${subType ? ` (${subType})` : ''}`);
            const result = await engine.download(url);

            // If successful, return immediately
            return result;
        } catch (error) {
            lastError = error as Error;
            logger.warn(`Engine ${engineName} failed: ${(error as Error).message}. Switching to next fallback...`);
            // Continue to next engine
        }
    }

    // 4. If all failed, throw the last error
    throw new Error(`All configured download engines failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}
