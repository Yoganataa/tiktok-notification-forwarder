
import { SystemConfigRepository } from '../../infra/system-config.repository';
import { ConfigManager, configManager } from '../../../../infra/config/config';
import { logger } from '../../../../infra/logger';
import { withTransaction } from '../../../../infra/database/transaction';

export class ManageSystemConfigUseCase {
  constructor(
    private readonly configRepo: SystemConfigRepository,
    private readonly configMgr: ConfigManager = configManager
  ) {}

  async toggleAutoDownload(): Promise<boolean> {
    const newStatus = await withTransaction(async (tx) => {
        const currentStatus = await this.configRepo.get('TT_DL', tx) === 'true';
        const newStatus = !currentStatus;
        await this.configRepo.set('TT_DL', String(newStatus), tx);
        return newStatus;
    });
    
    // Hot reload the config manager
    await this.configMgr.loadFromDatabase(this.configRepo);
    
    logger.info(`System Config Update: Auto Download set to ${newStatus} by Admin`);
    return newStatus;
  }

  async setDownloadEngine(engine: string): Promise<void> {
      const validEngines = ['liber', 'tikwm', 'douyin', 'musicaldown', 'tiktokv2', 'btch', 'tobyg74'];
      if (!validEngines.includes(engine)) {
          throw new Error(`Invalid engine: ${engine}. Must be one of: ${validEngines.join(', ')}`);
      }

      await withTransaction(async (tx) => {
          await this.configRepo.set('DOWNLOADER_ENGINE', engine, tx);
      });
      await this.configMgr.loadFromDatabase(this.configRepo);
      logger.info(`System Config Update: Engine set to ${engine} by Admin`);
  }

  async setConfig(key: string, value: string): Promise<void> {
    await withTransaction(async (tx) => {
        await this.configRepo.set(key, value, tx);
    });
    await this.configMgr.loadFromDatabase(this.configRepo);
    logger.info(`System Config Update: ${key} set to ${value} by Admin`);
  }

  async getSystemStatus() {
    return {
      autoDownload: this.configMgr.get().bot.enableDownloader,
      engine: this.configMgr.get().bot.downloaderEngine,
      totalGuilds: 0, // Placeholder, usually requires client context or another service
      dbDriver: this.configMgr.get().database.driver
    };
  }
}
