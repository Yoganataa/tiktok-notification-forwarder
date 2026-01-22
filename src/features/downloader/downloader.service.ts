import { DownloadEngine, DownloadResult } from './engines/types';
import { BtchEngine } from './engines/btch.engine';
import { TobyEngine } from './engines/toby.engine';
import { YtDlpEngine } from './engines/ytdlp.engine';
import { HansEngine } from './engines/hans.engine';
import { VetteEngine } from './engines/vette.engine';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { logger } from '../../shared/utils/logger';

export class DownloaderService {
  private engines: Map<string, DownloadEngine> = new Map();

  constructor(private configRepo: SystemConfigRepository) {
    this.registerEngine(new VetteEngine()); // Default priority?
    this.registerEngine(new BtchEngine());
    this.registerEngine(new TobyEngine());
    this.registerEngine(new YtDlpEngine());
    this.registerEngine(new HansEngine());
  }

  registerEngine(engine: DownloadEngine) {
    this.engines.set(engine.name, engine);
  }

  async download(url: string): Promise<DownloadResult> {
    let engineName = await this.configRepo.get('DOWNLOAD_ENGINE') || 'vette'; // Changed default to vette
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
    if (engine instanceof HansEngine && subType) {
        engine.setProvider(subType);
    } else if (engine instanceof TobyEngine && subType) {
        engine.setVersion(subType as 'v1' | 'v2' | 'v3');
    }

    logger.info(`Downloading using engine: ${engineName} (${subType || 'default'})`);
    return await engine.download(url);
  }
}
