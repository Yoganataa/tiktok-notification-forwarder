// src/modules/tiktok/infra/tiktok-api.client.ts
import { ttdl, douyin } from 'btch-downloader';
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
import { logger } from '../../../infra/logger';
import { DownloadResult, LiveStreamInfo, StalkResult } from '../domain';
import { TiktokApiPort } from '../ports/tiktok-api.port';

/**
 * Maps to 'v1', 'v2', 'v3' for TobyG74 API
 */
type TobyVersion = 'v1' | 'v2' | 'v3';

export class TiktokApiClient implements TiktokApiPort {

  /**
   * Helper to execute TobyG74 Downloader safely
   */
  private async executeTobyDownloader(url: string, version: TobyVersion): Promise<any | null> {
    try {
        const result = await Downloader(url, { version });
        if (result.status === 'success' && result.result) {
            return result.result;
        }
    } catch (error) {
        logger.debug(`TobyG74 ${version} attempt failed`, { error: (error as Error).message });
    }
    return null;
  }

  /**
   * Engine: BTCH (Default Legacy)
   * Library: btch-downloader -> ttdl
   */
  async downloadViaBtch(url: string): Promise<DownloadResult | null> {
    try {
        const data = await ttdl(url) as any;
        if (!data) return null;
        return this.normalizeBtchResponse(data, 'BTCH');
    } catch (error) {
        logger.error('Error in BTCH Downloader', { error: (error as Error).message });
        return null;
    }
  }

  /**
   * Engine: Douyin
   * Library: btch-downloader -> douyin
   */
  async downloadViaDouyin(url: string): Promise<DownloadResult | null> {
    try {
        const data = await douyin(url) as any;
        if (!data) return null;
        // Douyin response often matches BTCH structure roughly
        return this.normalizeBtchResponse(data, 'Douyin');
    } catch (error) {
        logger.error('Error in Douyin Downloader', { error: (error as Error).message });
        return null;
    }
  }

  private normalizeBtchResponse(data: any, source: string): DownloadResult | null {
     const videoUrls = data.video || data.url || [];
     const imageUrls = data.images || [];

     const author = data.author_name || data.nickname || `${source} User`;
     const description = data.title || data.description || data.desc || '';

     if (Array.isArray(videoUrls) && videoUrls.length > 0) {
         return { type: 'video', urls: videoUrls, description, author };
     } else if (typeof videoUrls === 'string' && videoUrls.length > 0) {
         return { type: 'video', urls: [videoUrls], description, author };
     }

     if (Array.isArray(imageUrls) && imageUrls.length > 0) {
         return { type: 'image', urls: imageUrls, description, author };
     }

     return null;
  }

  /**
   * Engine: TobyG74 Family
   * Library: @tobyg74/tiktok-api-dl
   */
  async downloadViaTobyg74(url: string, engine: string = 'tobyg74'): Promise<DownloadResult | null> {
      let version: TobyVersion = 'v1';
      switch (engine) {
          case 'tiktokv2': version = 'v2'; break;
          case 'musicaldown': version = 'v3'; break;
          default: version = 'v1'; break;
      }

      logger.debug(`Fetching via TobyG74 version: ${version} for engine: ${engine}`);

      const data = await this.executeTobyDownloader(url, version);
      if (!data) return null;

      // Normalization Logic based on Version
      if (data.type === 'video') {
         return this.extractVideoFromToby(data, version);
      }
      if (data.type === 'image') {
         return {
             type: 'image',
             urls: data.images || [],
             description: data.desc || '',
             author: data.author?.nickname || 'Unknown'
         };
      }
      return null;
  }

  private extractVideoFromToby(data: any, version: TobyVersion): DownloadResult | null {
      let videoUrls: string[] = [];
      let authorName = data.author?.nickname || data.author?.username || 'Unknown';
      const description = data.desc || '';

      if (version === 'v1') {
          const v = data.video;
          if (v) {
              if (Array.isArray(v.downloadAddr)) videoUrls = v.downloadAddr;
              else if (Array.isArray(v.playAddr)) videoUrls = v.playAddr;
              else if (v.noWatermark) videoUrls = Array.isArray(v.noWatermark) ? v.noWatermark : [v.noWatermark];
          }
      }
      else if (version === 'v2') {
          if (data.video?.playAddr) videoUrls = [data.video.playAddr];
      }
      else if (version === 'v3') {
          if (data.videoHD) videoUrls.push(data.videoHD);
          if (data.videoWatermark) videoUrls.push(data.videoWatermark);
      }

      // Final fallback
      if (videoUrls.length === 0 && data.video) {
           const vals = Object.values(data.video).filter(v => typeof v === 'string' && v.startsWith('http'));
           if (vals.length > 0) videoUrls = vals as string[];
      }

      return videoUrls.length > 0 ? { type: 'video', urls: videoUrls, description, author: authorName } : null;
  }

  // --- PASS-THROUGH METHODS ---
  // These just wrap the library calls with error handling.

  private async safeCall<T>(fn: () => Promise<any>): Promise<T> {
      try {
          const res = await fn();
          // Adjust checks based on library response patterns
          if (res.status === 'success' && res.result) return res.result;
          return [] as any; // Default empty
      } catch (e) {
          // logger.debug('TikTok API SafeCall error', { error: (e as Error).message });
          return [] as any;
      }
  }

  async search(query: string, type: 'user' | 'video' | 'live', cookie: string): Promise<any[]> {
    return this.safeCall(() => Search(query, { type, page: 1, cookie } as any));
  }

  async stalkUser(username: string, cookie: string): Promise<StalkResult | null> {
    const res = await this.safeCall<any>(() => StalkUser(username, { cookie } as any));
    if (!res || !res.user) return null;
    return {
        username: res.user.username,
        nickname: res.user.nickname,
        avatar: res.user.avatarThumb ?? res.user.avatar ?? '',
        signature: res.user.signature,
        followers: res.stats?.followerCount || 0,
        following: res.stats?.followingCount || 0,
        likes: res.stats?.heartCount || 0,
        videoCount: res.stats?.videoCount || 0
    };
  }

  async getLiveInfo(username: string, cookie: string): Promise<LiveStreamInfo | null> {
    const results = await this.search(username, 'live', cookie);
    if (!results || results.length === 0) return null;

    const stream = results.find((item: any) =>
        item.owner?.username?.toLowerCase() === username.toLowerCase()
    );

    if (!stream) return null;

    return {
        title: stream.title,
        cover: (stream.cover && stream.cover[0]) || '',
        viewerCount: stream.stats?.viewerCount || 0,
        totalUser: stream.stats?.totalUser || 0,
        startTime: stream.startTime
    };
  }

  async getVideoComments(url: string, cookie: string): Promise<any[]> {
      return this.safeCall(() => GetVideoComments(url, { cookie } as any));
  }

  async getUserPosts(username: string, cookie: string): Promise<any[]> {
      return this.safeCall(() => GetUserPosts(username, { cookie } as any));
  }

  async getUserReposts(username: string, cookie: string): Promise<any[]> {
      return this.safeCall(() => GetUserReposts(username, { cookie } as any));
  }

  async getUserLiked(username: string, cookie: string): Promise<any[]> {
      return this.safeCall(() => GetUserLiked(username, { cookie } as any));
  }

  async getCollection(url: string, cookie: string): Promise<any[]> {
      const res: any = await this.safeCall(() => Collection(url, { cookie } as any));
      return res.itemList || [];
  }

  async getPlaylist(url: string, cookie: string): Promise<any[]> {
      const res: any = await this.safeCall(() => Playlist(url, { cookie } as any));
      return res.itemList || [];
  }

  async getTrending(type: 'content' | 'creators', cookie: string): Promise<any[]> {
      if (type === 'content') {
           return this.safeCall(() => Trending({ cookie } as any));
      } else {
           const res: any = await this.safeCall(() => TrendingCreators({ cookie } as any));
           return res.users || [];
      }
  }

  async getMusicDetail(url: string, cookie: string): Promise<any | null> {
      const res = await this.safeCall(() => GetMusicDetail(url, { cookie } as any));
      return Array.isArray(res) && res.length === 0 ? null : res;
  }

  async getMusicVideos(url: string, cookie: string): Promise<any | null> {
      const res = await this.safeCall(() => GetVideosByMusicId(url, { cookie } as any));
      return Array.isArray(res) && res.length === 0 ? null : res;
  }
}
