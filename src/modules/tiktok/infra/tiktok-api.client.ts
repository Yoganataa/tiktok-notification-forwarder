// src/modules/tiktok/infra/tiktok-api.client.ts
import { ttdl, douyin } from 'btch-downloader'; // Import douyin
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

export class TiktokApiClient implements TiktokApiPort {

  /**
   * Engine: BTCH (Default Legacy)
   * Library: btch-downloader -> ttdl
   */
  async downloadViaBtch(url: string): Promise<DownloadResult | null> {
    try {
        const data = await ttdl(url) as any;
        if (!data) return null;

        // Handle Video
        if (data.video && Array.isArray(data.video) && data.video.length > 0) {
            return {
                type: 'video',
                urls: data.video, 
                description: data.description || '',
                author: data.author_name || 'Unknown'
            };
        }
        // Handle Images (Slide)
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

  /**
   * Engine: Douyin
   * Library: btch-downloader -> douyin
   */
  async downloadViaDouyin(url: string): Promise<DownloadResult | null> {
    try {
        const data = await douyin(url) as any;
        if (!data) return null;

        // Normalize response structure from btch-downloader (douyin usually similar structure)
        const videoUrls = data.video || data.url || [];
        const imageUrls = data.images || [];

        if (videoUrls.length > 0) {
             return {
                type: 'video',
                urls: Array.isArray(videoUrls) ? videoUrls : [videoUrls],
                description: data.title || data.description || '',
                author: data.author_name || 'Douyin User'
            };
        }

        if (imageUrls.length > 0) {
            return {
                type: 'image',
                urls: imageUrls,
                description: data.title || data.description || '',
                author: data.author_name || 'Douyin User'
            };
        }

        return null;
    } catch (error) {
        logger.error('Error in Douyin Downloader', { error: (error as Error).message });
        return null;
    }
  }

  /**
   * Engine: TobyG74 Family
   * Library: @tobyg74/tiktok-api-dl
   * Supports: Liber (v1), TikWM (v1), TikTokV2 (v2), MusicalDown (v3)
   */
  async downloadViaTobyg74(url: string, engine: string = 'tobyg74'): Promise<DownloadResult | null> {
    try {
        let version: 'v1' | 'v2' | 'v3' = 'v1';
        
        switch (engine) {
            case 'tiktokv2': 
                version = 'v2'; // SSSTik
                break;
            case 'musicaldown': 
                version = 'v3'; // MusicalDown
                break;
            case 'liber':
            case 'tikwm':
            case 'tobyg74':
            default:
                version = 'v1'; // Default / Liber / TikWM
                break;
        }

        logger.debug(`Fetching via TobyG74 version: ${version} for engine: ${engine}`);
        const result = await Downloader(url, { version });
        
        if (result.status !== 'success' || !result.result) {
            logger.warn(`TobyG74 ${version} failed or returned empty result.`);
            return null;
        }

        const data = result.result;
        
        // --- TYPE: VIDEO ---
        if (data.type === 'video') {
            const anyData = data as any;
            let videoUrls: string[] = [];
            let authorName = 'Unknown';
            let description = data.desc || '';

            // V1 Response Parsing (Liber / TikWM)
            if (version === 'v1') {
                 const v = anyData.video;
                 if (v) {
                     if (v.downloadAddr && Array.isArray(v.downloadAddr)) {
                         videoUrls = v.downloadAddr;
                     } else if (v.playAddr && Array.isArray(v.playAddr)) {
                         videoUrls = v.playAddr;
                     } else if (v.noWatermark) {
                         // Some v1 responses might put it here
                         videoUrls = Array.isArray(v.noWatermark) ? v.noWatermark : [v.noWatermark];
                     }
                 }
                 authorName = anyData.author?.nickname || anyData.author?.username || 'Unknown';
            }
            // V2 Response Parsing (SSSTik)
            else if (version === 'v2') {
                 if (anyData.video?.playAddr) {
                     videoUrls = [anyData.video.playAddr];
                 }
                 authorName = anyData.author?.nickname || 'Unknown';
            }
            // V3 Response Parsing (MusicalDown)
            else if (version === 'v3') {
                 if (anyData.videoHD) videoUrls.push(anyData.videoHD);
                 if (anyData.videoWatermark) videoUrls.push(anyData.videoWatermark);
                 authorName = anyData.author?.nickname || 'Unknown';
            }

            // Fallback for V1 if standard fields fail but keys exist loosely
            if (videoUrls.length === 0 && anyData.video) {
                 const vals = Object.values(anyData.video).filter(v => typeof v === 'string' && v.startsWith('http'));
                 if (vals.length > 0) videoUrls = vals as string[];
            }

            if (videoUrls.length === 0) return null;

            return {
                type: 'video',
                urls: videoUrls,
                description,
                author: authorName
            };
        }
        
        // --- TYPE: IMAGE ---
        if (data.type === 'image') {
            const anyData = data as any;
            return {
                type: 'image',
                urls: anyData.images || [],
                description: anyData.desc || '',
                author: anyData.author?.nickname || 'Unknown'
            };
        }
        return null;
    } catch (error) {
        logger.error('Error in TobyG74 Downloader', { error: (error as Error).message });
        return null;
    }
  }

  async search(query: string, type: 'user' | 'video' | 'live', cookie: string): Promise<any[]> {
    try {
      const result = await Search(query, { type, page: 1, cookie } as any);
      return (result.status === 'success' && result.result) ? result.result : [];
    } catch (error) {
      logger.error('Search error', { error: (error as Error).message });
      return [];
    }
  }

  async stalkUser(username: string, cookie: string): Promise<StalkResult | null> {
    try {
      const result = await StalkUser(username, { cookie } as any);
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

  async getLiveInfo(username: string, cookie: string): Promise<LiveStreamInfo | null> {
    try {
      const result = await Search(username, { type: 'live', cookie } as any);
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

  async getVideoComments(url: string, cookie: string): Promise<any[]> {
      try {
          const result = await GetVideoComments(url, { cookie } as any);
          // Correct: result.result is the array of comments
          return (result.status === 'success' && result.result) ? result.result : [];
      } catch (error) { return []; }
  }

  async getUserPosts(username: string, cookie: string): Promise<any[]> {
      try {
          const result = await GetUserPosts(username, { cookie } as any);
          // Correct: result.result is the array of posts
          return (result.status === 'success' && result.result) ? result.result : []; 
      } catch (error) { return []; }
  }

  async getUserReposts(username: string, cookie: string): Promise<any[]> {
    try {
        const result = await GetUserReposts(username, { cookie } as any);
        // Correct: result.result is the array of reposts
        return (result.status === 'success' && result.result) ? result.result : [];
    } catch (error) { return []; }
  }

  async getUserLiked(username: string, cookie: string): Promise<any[]> {
    try {
        const result = await GetUserLiked(username, { cookie } as any);
        // Correct: result.result is the array of liked items
        return (result.status === 'success' && result.result) ? result.result : [];
    } catch (error) { return []; }
  }

  async getCollection(url: string, cookie: string): Promise<any[]> {
    try {
        const result = await Collection(url, { cookie } as any);
        // Correct: result.result has property 'itemList'
        return (result.status === 'success' && result.result) ? (result.result as any).itemList : [];
    } catch (error) { return []; }
  }

  async getPlaylist(url: string, cookie: string): Promise<any[]> {
    try {
        const result = await Playlist(url, { cookie } as any);
        // Correct: result.result has property 'itemList'
        return (result.status === 'success' && result.result) ? (result.result as any).itemList : [];
    } catch (error) { return []; }
  }

  async getTrending(type: 'content' | 'creators', cookie: string): Promise<any[]> {
    try {
        if (type === 'content') {
            const result = await Trending({ cookie } as any);
            return (result.status === 'success' && result.result) ? result.result : [];
        } else {
             const result = await TrendingCreators({ cookie } as any);
             return (result.status === 'success' && result.result && 'users' in result.result) ? (result.result as any).users : [];
        }
    } catch (error) { return []; }
  }

  async getMusicDetail(url: string, cookie: string): Promise<any | null> {
      try {
          const result = await GetMusicDetail(url, { cookie } as any);
          return (result.status === 'success' && result.result) ? result.result : null;
      } catch (error) { return null; }
  }

  async getMusicVideos(url: string, cookie: string): Promise<any | null> {
      try {
          const result = await GetVideosByMusicId(url, { cookie } as any);
          return (result.status === 'success' && result.result) ? result.result : null;
      } catch (error) { return null; }
  }
}
