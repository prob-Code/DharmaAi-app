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

    const videos = await searchYouTube({
      apiKey: env.YOUTUBE_API_KEY,
      query: parsed.q,
      maxResults: parsed.maxResults,
      language: parsed.language
    });

    res.json({ videos });
  } catch (error) {
    next(error);
  }
});
