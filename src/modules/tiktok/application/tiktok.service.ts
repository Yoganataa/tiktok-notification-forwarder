// src/modules/tiktok/application/tiktok.service.ts
import { configManager } from '../../../infra/config/config';
import { logger } from '../../../infra/logger'; 
import { DownloadResult, LiveStreamInfo, StalkResult } from '../domain';
import { TiktokApiPort } from '../ports/tiktok-api.port';

export class TiktokDownloadService {
  constructor(private readonly apiClient: TiktokApiPort) {}
  
  private getCookie(): string {
      return configManager.get().bot.tiktokCookie;
  }

  /**
   * Universal Downloader (Hybrid: BTCH / TobyG74)
   */
  async download(url: string): Promise<DownloadResult | null> {
    const config = configManager.get();
    const engine = config.bot.downloaderEngine;

    logger.info(`Downloading media using engine: ${engine.toUpperCase()}`, { url });

    // Routing Logic
    if (engine === 'btch') {
        return await this.apiClient.downloadViaBtch(url);
    } 
    else if (engine === 'douyin') {
        // Gunakan dedicated douyin scraper dari btch-downloader
        return await this.apiClient.downloadViaDouyin(url);
    } 
    else {
        // Fallback ke TobyG74 (Liber, TikWM, TikTokV2, MusicalDown)
        return await this.apiClient.downloadViaTobyg74(url, engine);
    }
  }

  async search(query: string, type: 'user' | 'video' | 'live'): Promise<any[]> {
      return await this.apiClient.search(query, type, this.getCookie());
  }

  async stalkUser(username: string): Promise<StalkResult | null> {
      return await this.apiClient.stalkUser(username, this.getCookie());
  }
  
  async getLiveInfo(username: string): Promise<LiveStreamInfo | null> {
      return await this.apiClient.getLiveInfo(username, this.getCookie());
  }

  // --- New Methods Delegating to Client ---

  async getVideoComments(url: string): Promise<any[]> {
      return await this.apiClient.getVideoComments(url, this.getCookie());
  }

  async getUserPosts(username: string): Promise<any[]> {
      return await this.apiClient.getUserPosts(username, this.getCookie());
  }

  async getUserReposts(username: string): Promise<any[]> {
      return await this.apiClient.getUserReposts(username, this.getCookie());
  }

  async getUserLiked(username: string): Promise<any[]> {
      return await this.apiClient.getUserLiked(username, this.getCookie());
  }

  async getCollection(url: string): Promise<any[]> {
      return await this.apiClient.getCollection(url, this.getCookie());
  }

  async getPlaylist(url: string): Promise<any[]> {
      return await this.apiClient.getPlaylist(url, this.getCookie());
  }

  async getTrending(type: 'content' | 'creators'): Promise<any[]> {
      return await this.apiClient.getTrending(type, this.getCookie());
  }

  async getMusicDetail(url: string): Promise<any | null> {
      return await this.apiClient.getMusicDetail(url, this.getCookie());
  }

  async getMusicVideos(url: string): Promise<any | null> {
      return await this.apiClient.getMusicVideos(url, this.getCookie());
  }
}
