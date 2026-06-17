export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
}
