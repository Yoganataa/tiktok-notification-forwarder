export interface DownloadResult {
  type: 'video' | 'image';
  buffer?: Buffer;
  buffers?: Buffer[];
  url?: string;
  urls: string[];
}

export abstract class BaseDownloadEngine {
  abstract get name(): string;
  abstract download(url: string): Promise<DownloadResult>;
}
