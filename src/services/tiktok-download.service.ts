// src/services/tiktok-download.service.ts
import { ttdl } from 'btch-downloader';
import { 
    Downloader, 
    Search, 
    StalkUser,
    GetVideoComments,
    GetUserPosts,
    GetUserReposts,
    GetUserLiked,
    Collection,
    Playlist,
    Trending,
    TrendingCreators,
    GetVideosByMusicId,
    GetMusicDetail
} from '@tobyg74/tiktok-api-dl';
import { logger } from '../utils/logger';
import { configManager } from '../core/config/config';

// --- Interfaces ---
export interface DownloadResult {
  type: 'video' | 'image';
  urls: string[];
  description?: string;
  author?: string;
}

export interface LiveStreamInfo {
  title: string;
  cover: string;
  viewerCount: number;
  totalUser: number;
  startTime: number;
}

export interface StalkResult {
  username: string;
  nickname: string;
  avatar: string;
  signature: string;
  followers: number;
  following: number;
  likes: number;
  videoCount: number;
}

export class TiktokDownloadService {
  
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

    if (engine === 'btch') {
        return await this.downloadViaBtch(url);
    } else {
        return await this.downloadViaTobyg74(url);
    }
  }

  private async downloadViaBtch(url: string): Promise<DownloadResult | null> {
    try {
        const data = await ttdl(url) as any;
        if (!data) return null;

        if (data.video && Array.isArray(data.video) && data.video.length > 0) {
            return {
                type: 'video',
                urls: data.video, 
                description: data.description || '',
                author: data.author_name || 'Unknown'
            };
        }
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            return {
                type: 'image',
                urls: data.images,
                description: data.description || '',
                author: data.author_name || 'Unknown'
            };
        }
        return null;
    } catch (error) {
        logger.error('Error in BTCH Downloader', { error: (error as Error).message });
        return null;
    }
  }

  private async downloadViaTobyg74(url: string): Promise<DownloadResult | null> {
    try {
        const result = await Downloader(url, { version: 'v1' });
        if (result.status !== 'success' || !result.result) return null;

        const data = result.result;
        
        // FIX TS2339: Cast video object to any to access 'noWatermark'
        if (data.type === 'video' && data.video) {
            const videoData = data.video as any; 
            
            let videoUrls: string[] = [];

            if (videoData.noWatermark) {
                videoUrls = Array.isArray(videoData.noWatermark) ? videoData.noWatermark : [videoData.noWatermark];
            } else {
                videoUrls = videoData.downloadAddr || videoData.playAddr || [];
            }
            
            return {
                type: 'video',
                urls: videoUrls,
                description: data.desc,
                author: data.author?.nickname || 'Unknown'
            };
        }
        
        if (data.type === 'image' && data.images) {
            return {
                type: 'image',
                urls: data.images,
                description: data.desc,
                author: data.author?.nickname || 'Unknown'
            };
        }
        return null;
    } catch (error) {
        logger.error('Error in TobyG74 Downloader', { error: (error as Error).message });
        return null;
    }
  }

  // --- Features ---

  async search(query: string, type: 'user' | 'video' | 'live'): Promise<any[]> {
    try {
      // FIX TS2353: Cast options to any to pass 'cookie'
      const result = await Search(query, { type, page: 1, cookie: this.getCookie() } as any);
      return (result.status === 'success' && result.result) ? result.result : [];
    } catch (error) {
      logger.error('Search error', { error: (error as Error).message });
      return [];
    }
  }

  async stalkUser(username: string): Promise<StalkResult | null> {
    try {
      // FIX TS2353: Cast options to any to pass 'cookie'
      const result = await StalkUser(username, { cookie: this.getCookie() } as any);
      if (result.status === 'success' && result.result) {
        const u = result.result.user;
        const s = result.result.stats;
        const userAny = u as any;
        return {
          username: u.username,
          nickname: u.nickname,
          avatar: userAny.avatarThumb ?? userAny.avatar ?? '',
          signature: u.signature,
          followers: s.followerCount,
          following: s.followingCount,
          likes: s.heartCount,
          videoCount: s.videoCount
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getVideoComments(url: string): Promise<any[]> {
      try {
          // FIX TS2353: Cast options to any
          const result = await GetVideoComments(url, { commentLimit: 10, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result) ? result.result : [];
      } catch (error) { return []; }
  }

  async getUserPosts(username: string): Promise<any[]> {
      try {
          // FIX TS2353: Cast options to any
          const result = await GetUserPosts(username, { postLimit: 10, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result) ? result.result : [];
      } catch (error) { return []; }
  }

  async getUserReposts(username: string): Promise<any[]> {
      try {
          // FIX TS2353: Cast options to any
          const result = await GetUserReposts(username, { postLimit: 10, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result) ? result.result : [];
      } catch (error) { return []; }
  }

  async getUserLiked(username: string): Promise<any[]> {
      try {
          // FIX TS2353: Cast options to any
          const result = await GetUserLiked(username, { postLimit: 10, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result) ? result.result : [];
      } catch (error) { return []; }
  }

  async getCollection(idOrUrl: string): Promise<any[]> {
      try {
          // FIX TS2353: Cast options to any
          const result = await Collection(idOrUrl, { count: 5, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result && result.result.itemList) ? result.result.itemList : [];
      } catch (error) { return []; }
  }

  async getPlaylist(idOrUrl: string): Promise<any[]> {
      try {
          // FIX TS2353: Cast options to any
          const result = await Playlist(idOrUrl, { count: 5, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result && result.result.itemList) ? result.result.itemList : [];
      } catch (error) { return []; }
  }

  async getTrending(type: 'content' | 'creators'): Promise<any[]> {
      try {
          if (type === 'creators') {
              // FIX TS2353: Cast options to any
              const result = await TrendingCreators({ cookie: this.getCookie() } as any);
              return (result.status === 'success' && result.result) ? result.result : [];
          } else {
              // FIX TS2353: Cast options to any
              const result = await Trending({ cookie: this.getCookie() } as any);
              return (result.status === 'success' && result.result && result.result[0]) ? result.result[0].exploreList : [];
          }
      } catch (error) { return []; }
  }

  async getMusicVideos(idOrUrl: string): Promise<any> {
      try {
          // FIX TS2353: Cast options to any
          const result = await GetVideosByMusicId(idOrUrl, { count: 10, cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result) ? result.result : null;
      } catch (error) { return null; }
  }

  async getMusicDetail(idOrUrl: string): Promise<any> {
      try {
          // FIX TS2353: Cast options to any
          const result = await GetMusicDetail(idOrUrl, { cookie: this.getCookie() } as any);
          return (result.status === 'success' && result.result) ? result.result : null;
      } catch (error) { return null; }
  }

  async getLiveInfo(username: string): Promise<LiveStreamInfo | null> {
    try {
      // FIX TS2353: Cast options to any
      const result = await Search(username, { type: 'live', cookie: this.getCookie() } as any);
      if (result.status === 'success' && result.result && result.result.length > 0) {
        const stream = result.result.find((item: any) => item.owner.username.toLowerCase() === username.toLowerCase());
        if (stream) {
          const streamData = stream as any;
          return {
            title: streamData.title,
            cover: (streamData.cover && streamData.cover[0]) || '', 
            viewerCount: streamData.stats.viewerCount,
            totalUser: streamData.stats.totalUser,
            startTime: streamData.startTime
          };
        }
      }
      return null;
    } catch (error) { return null; }
  }
}