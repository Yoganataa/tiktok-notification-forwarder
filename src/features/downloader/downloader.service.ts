import { BaseDownloadEngine, DownloadResult } from '../../core/contracts/module.contract';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { logger } from '../../shared/utils/logger';
import { ModuleLoader } from '../../core/services/module-loader.service';
import HansEngine from './engines/hans.engine';
import TobyEngine from './engines/toby.engine';

export class DownloaderService {
  private engines: Map<string, BaseDownloadEngine> = new Map();

  constructor(private configRepo: SystemConfigRepository) {}

  async init() {
     const engines = await ModuleLoader.loadModules<BaseDownloadEngine>('src/features/downloader/engines/**/*.engine.ts', BaseDownloadEngine);
     engines.forEach(engine => this.registerEngine(engine));
     logger.info(`[DownloaderService] Initialized with ${engines.length} engines.`);
  }

  registerEngine(engine: BaseDownloadEngine) {
    this.engines.set(engine.name, engine);
  }

  async download(url: string): Promise<DownloadResult> {
    let engineName = await this.configRepo.get('DOWNLOAD_ENGINE') || 'vette';
    // Format: "engine:subtype" e.g. "hans:snaptik" or "tobyg74:v2"
    let subType = '';

    if (engineName.includes(':')) {
        [engineName, subType] = engineName.split(':');
    }

    const engine = this.engines.get(engineName);
    if (!engine) {
      throw new Error(`Engine ${engineName} not found`);
    }

    // Configure sub-engine if applicable
    // We cast to any because these specific methods aren't on BaseDownloadEngine
    // In a cleaner design, we might have 'configure(options)' on the Base class.
    if (engine instanceof HansEngine && subType) {
        engine.setProvider(subType);
    } else if (engine instanceof TobyEngine && subType) {
        engine.setVersion(subType as 'v1' | 'v2' | 'v3');
    }

    logger.info(`Downloading using engine: ${engineName} (${subType || 'default'})`);
    return await engine.download(url);
  }
}
