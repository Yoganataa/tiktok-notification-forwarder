import { BaseDownloadEngine, DownloadResult } from '../core/contracts/download.contract';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { logger } from '../shared/utils/logger';
import HansEngine from './engines/hans.engine';
import VetteEngine from './engines/vette.engine';
import BtchEngine from './engines/btch.engine';
import YtDlpEngine from './engines/ytdlp.engine';

export class DownloaderService {
  private engines: Map<string, BaseDownloadEngine> = new Map();

  constructor(private configRepo: SystemConfigRepository) {}

  async init() {
     if (this.engines.size > 0) return;

     this.registerEngine(new VetteEngine());
     this.registerEngine(new HansEngine());
     this.registerEngine(new BtchEngine());
     this.registerEngine(new YtDlpEngine());

     logger.info(`[DownloaderService] Initialized with ${this.engines.size} engines.`);
  }

  registerEngine(engine: BaseDownloadEngine) {
    this.engines.set(engine.name, engine);
  }

  async download(url: string): Promise<DownloadResult> {
    let engineName = await this.configRepo.get('DOWNLOAD_ENGINE') || 'vette';
    let subType = '';

    if (engineName.includes(':')) {
        [engineName, subType] = engineName.split(':');
    }

    const engine = this.engines.get(engineName);
    if (!engine) {
      throw new Error(`Engine ${engineName} not found`);
    }

    if (engine instanceof HansEngine && subType) {
        (engine as HansEngine).setProvider(subType);
    }

    logger.info(`Downloading using engine: ${engineName} (${subType || 'default'})`);
    return await engine.download(url);
  }
}
