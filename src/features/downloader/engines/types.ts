export interface DownloadResult {
  type: 'video' | 'image';
  buffer?: Buffer;
  url?: string;
  urls: string[];
}

export interface DownloadEngine {
  name: string;
  download(url: string): Promise<DownloadResult>;
}
