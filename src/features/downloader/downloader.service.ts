import { DownloadEngine, DownloadResult } from './engines/types';
import { BtchEngine } from './engines/btch.engine';
import { TobyEngine } from './engines/toby.engine';
import { YtDlpEngine } from './engines/ytdlp.engine';
import { HansEngine } from './engines/hans.engine';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { logger } from '../../shared/utils/logger';

export class DownloaderService {
  private engines: Map<string, DownloadEngine> = new Map();
  private systemConfig: SystemConfigRepository;

  constructor(systemConfig: SystemConfigRepository) {
    this.systemConfig = systemConfig;
    this.register(new BtchEngine());
    this.register(new TobyEngine());
    this.register(new YtDlpEngine());
    this.register(new HansEngine());
  }

  register(engine: DownloadEngine) {
    this.engines.set(engine.name, engine);
  }

  async download(url: string): Promise<DownloadResult> {
    const engineName = await this.systemConfig.get('DOWNLOAD_ENGINE') || 'btch';
    const engine = this.engines.get(engineName) || this.engines.get('btch');

    if (!engine) throw new Error('No download engine available');

    try {
      logger.info(`Downloading using engine: ${engine.name}`);
      return await engine.download(url);
    } catch (error) {
      logger.warn(`Engine ${engine.name} failed`, { error: (error as Error).message });
      throw error;
    }
  }

  getEngineNames(): string[] {
      return Array.from(this.engines.keys());
  }
}
