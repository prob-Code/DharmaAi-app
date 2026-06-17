import { YouTubeVideoItem } from "../types/api";

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

export async function searchYouTube(params: {
  apiKey: string;
  query: string;
  maxResults: number;
  language: "en" | "hi";
}): Promise<YouTubeVideoItem[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(params.maxResults));
  url.searchParams.set("q", params.query);
  url.searchParams.set("key", params.apiKey);
  url.searchParams.set("order", "relevance");
  url.searchParams.set("relevanceLanguage", params.language);

  const response = await fetch(url.toString());
  const data = (await response.json()) as YouTubeSearchResponse;

  if (!response.ok || data.error) {
    const message = data.error?.message || `YouTube API error: ${response.status}`;
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = response.status || data.error?.code || 502;
    throw err;
  }

  return (data.items || [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;

      return {
        id: videoId,
        title: item.snippet?.title || "Untitled",
        channelTitle: item.snippet?.channelTitle || "Unknown",
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        publishedAt: item.snippet?.publishedAt || ""
      };
    })
    .filter((v): v is YouTubeVideoItem => Boolean(v));
}
