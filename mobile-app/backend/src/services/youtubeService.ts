import { YouTubeVideoItem } from "../types/api";
import ytSearch from "yt-search";

export async function searchYouTube(params: {
  apiKey?: string; // Kept for backwards compatibility; yt-search does not require it.
  query: string;
  maxResults: number;
  language: "en" | "hi";
}): Promise<YouTubeVideoItem[]> {
  try {
    console.log(`[YouTube Service] Searching yt-search for: ${params.query}`);

    // ytSearch bypasses the official API and scrapes YouTube, meaning NO QUOTAS!
    const result = await ytSearch(params.query);

    const videos = result.videos.slice(0, params.maxResults || 12);

    return videos.map((item) => ({
      id: item.videoId,
      title: item.title || "Untitled",
      channelTitle: item.author?.name || "Unknown Channel",
      thumbnail: item.thumbnail || item.image || "",
      publishedAt: item.ago || "" // yt-search gives us 'ago' string instead of date
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[YouTube Service] search unavailable:", message.slice(0, 300));
    const err = new Error("Failed to fetch videos from YouTube") as Error & { statusCode?: number };
    err.statusCode = 502;
    throw err;
  }
}
