import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { logger } from '../shared/utils/logger';

export class StartupService {
  static async init(): Promise<void> {
    logger.info('🚀 Initializing services...');
    await this.initYtDlp();
    await this.verifyDependencies();
    logger.info('✅ Initialization complete.');
  }

  private static async initYtDlp(): Promise<void> {
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const binaryPath = path.resolve(`./${binaryName}`);

    if (!fs.existsSync(binaryPath)) {
      logger.info('📥 Downloading yt-dlp binary...');
      try {
        const url = process.platform === 'win32'
            ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
            : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

        await this.downloadFile(url, binaryPath);

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

  private static async downloadFile(url: string, dest: string): Promise<void> {
      const writer = fs.createWriteStream(dest);
      const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream'
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
      });
  }

  private static async verifyDependencies(): Promise<void> {
    // Check for runtime requirements that might be missing in some environments
    try {
        require('cheerio');
        require('youtube-dl-exec');
        logger.info('✅ Critical runtime dependencies verified.');
    } catch (error) {
        logger.warn('⚠️ Some dependencies might be missing or failed to load.', { error });
    }
  }
}
