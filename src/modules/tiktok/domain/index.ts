// src/modules/tiktok/domain/index.ts

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
