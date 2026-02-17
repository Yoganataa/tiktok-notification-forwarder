import { BaseDownloadEngine, DownloadResult } from '../../contracts/download.contract';
import path from 'path';
import fs from 'fs';
import { create as createYoutubeDl } from 'youtube-dl-exec';

export default class YtDlpEngine extends BaseDownloadEngine {
  name = 'yt-dlp';

  private getBinaryPath(): string {
      const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      return path.resolve(`./${binaryName}`);
  }

  async download(url: string): Promise<DownloadResult> {
    const binaryPath = this.getBinaryPath();

    if (!fs.existsSync(binaryPath)) {
        throw new Error('yt-dlp binary not found. Please wait for initialization.');
    }

    // Create a youtube-dl instance pointing to our local binary
    const youtubedl = createYoutubeDl(binaryPath);

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        // exec returns a ChildProcess-like object (execa)
        const subprocess = youtubedl.exec(url, {
            output: '-',
            quiet: true,
            noWarnings: true,
        });

        // We need to access stdout from the subprocess
        // youtube-dl-exec uses 'execa'. The subprocess has stdout property.

        if (subprocess.stdout) {
            subprocess.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
        }

        if (subprocess.stderr) {
            subprocess.stderr.on('data', (chunk: Buffer) => console.error(`yt-dlp stderr: ${chunk}`));
        }

        // execa promise resolves when process finishes
        subprocess.then(() => {
            resolve({
                type: 'video',
                buffer: Buffer.concat(chunks),
                urls: [url]
            });
        }).catch((err: Error) => {
            reject(new Error(`yt-dlp failed: ${err.message}`));
        });
    });
  }
}
