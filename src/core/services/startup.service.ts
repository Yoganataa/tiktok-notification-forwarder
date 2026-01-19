import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';
import { logger } from '../../shared/utils/logger';

export class StartupService {
  static async init(): Promise<void> {
    logger.info('🚀 Initializing services...');
    await this.initYtDlp();
    await this.verifyDependencies();
    logger.info('✅ Initialization complete.');
  }

  private static async initYtDlp(): Promise<void> {
    const binaryPath = path.resolve('./yt-dlp');
    if (!fs.existsSync(binaryPath)) {
      logger.info('📥 Downloading yt-dlp binary...');
      try {
        await YTDlpWrap.downloadFromGithub(binaryPath);
        // Make executable on Linux/Mac
        if (process.platform !== 'win32') {
            fs.chmodSync(binaryPath, '755');
        }
        logger.info('✅ yt-dlp binary downloaded successfully.');
      } catch (error) {
        logger.error('❌ Failed to download yt-dlp binary', { error });
      }
    } else {
        logger.info('✅ yt-dlp binary already exists.');
    }
  }

  private static async verifyDependencies(): Promise<void> {
    // Check for runtime requirements that might be missing in some environments
    try {
        require('vm2');
        require('cheerio');
        require('btch-downloader');
        logger.info('✅ Critical runtime dependencies verified.');
    } catch (error) {
        logger.warn('⚠️ Some dependencies might be missing or failed to load.', { error });
    }
  }
}
