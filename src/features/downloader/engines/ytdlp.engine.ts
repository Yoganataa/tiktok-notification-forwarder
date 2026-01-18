import { DownloadEngine, DownloadResult } from './types';
import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export class YtDlpEngine implements DownloadEngine {
  name = 'yt-dlp';
  private ytDlpWrap: YTDlpWrap | null = null;

  private async getWrapper(): Promise<YTDlpWrap> {
      if (this.ytDlpWrap) return this.ytDlpWrap;

      const binaryPath = path.resolve('./yt-dlp');
      if (!fs.existsSync(binaryPath)) {
          console.log('Downloading yt-dlp binary...');
          await YTDlpWrap.downloadFromGithub(binaryPath);
          console.log('Downloaded yt-dlp binary.');
      }
      this.ytDlpWrap = new YTDlpWrap(binaryPath);
      return this.ytDlpWrap;
  }

  async download(url: string): Promise<DownloadResult> {
    await this.getWrapper();
    const binaryPath = path.resolve('./yt-dlp');

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const process = spawn(binaryPath, [url, '-o', '-', '--quiet']);

        process.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
        process.stderr.on('data', (chunk: Buffer) => console.error(`yt-dlp stderr: ${chunk}`));

        process.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`yt-dlp exited with code ${code}`));
            else {
                resolve({
                    type: 'video',
                    buffer: Buffer.concat(chunks),
                    urls: [url]
                });
            }
        });

        process.on('error', (err: Error) => reject(err));
    });
  }
}
