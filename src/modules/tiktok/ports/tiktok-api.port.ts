import { DownloadResult, LiveStreamInfo, StalkResult } from '../domain';

export interface TiktokApiPort {
  downloadViaBtch(url: string): Promise<DownloadResult | null>;
  downloadViaDouyin(url: string): Promise<DownloadResult | null>;
  downloadViaTobyg74(url: string, engine?: string): Promise<DownloadResult | null>;
  search(query: string, type: 'user' | 'video' | 'live', cookie: string): Promise<any[]>;
  stalkUser(username: string, cookie: string): Promise<StalkResult | null>;
  getLiveInfo(username: string, cookie: string): Promise<LiveStreamInfo | null>;
  getVideoComments(url: string, cookie: string): Promise<any[]>;
  getUserPosts(username: string, cookie: string): Promise<any[]>;
  getUserReposts(username: string, cookie: string): Promise<any[]>;
  getUserLiked(username: string, cookie: string): Promise<any[]>;
  getCollection(url: string, cookie: string): Promise<any[]>;
  getPlaylist(url: string, cookie: string): Promise<any[]>;
  getTrending(type: 'content' | 'creators', cookie: string): Promise<any[]>;
  getMusicDetail(url: string, cookie: string): Promise<any | null>;
  getMusicVideos(url: string, cookie: string): Promise<any | null>;
}
