import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { searchYouTube } from "../services/youtubeService";

const querySchema = z.object({
  q: z.string().min(1),
  maxResults: z.coerce.number().int().min(1).max(12).default(12),
  language: z.enum(["en", "hi"]).default("en")
});

export const youtubeRouter = Router();

youtubeRouter.get("/search", async (req, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);
    try {
      const videos = await searchYouTube({
        apiKey: env.YOUTUBE_API_KEY || "",
        query: parsed.q,
        maxResults: parsed.maxResults,
        language: parsed.language
      });

      res.json({ videos, source: "youtube" });
    } catch (error) {
      // YouTube search is optional; the mobile app has a curated offline
      // library. Return an empty successful response instead of turning a
      // temporary upstream/network failure into a visible 502 error.
      console.warn("[YouTube] Search unavailable; using mobile fallback:", error instanceof Error ? error.message : error);
      res.json({ videos: [], source: "offline-fallback" });
    }
  } catch (error) {
    next(error);
  }
});
