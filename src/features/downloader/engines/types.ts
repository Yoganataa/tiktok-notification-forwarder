export interface DownloadResult {
  type: 'video' | 'image';
  buffer?: Buffer;
  buffers?: Buffer[]; // Added to support multiple images
  url?: string;
  urls: string[];
}

export interface DownloadEngine {
  name: string;
  download(url: string): Promise<DownloadResult>;
}
