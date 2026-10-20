import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";

const bodySchema = z.object({
  text: z.string().min(1).max(2500),
  language_code: z.enum(["en-IN", "hi-IN"]),
  speaker: z.enum(["priya", "shubh", "aditya"]),
  pace: z.number().min(0.5).max(2),
  temperature: z.number().min(0.01).max(1),
  speech_sample_rate: z.number().int().positive(),
  output_audio_codec: z.enum(["wav", "mp3", "aac", "flac", "linear16"]),
  model: z.literal("bulbul:v3")
});

export const ttsRouter = Router();
ttsRouter.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.get("x-user-id") || req.ip || "anonymous"
}));

ttsRouter.post("/sarvam", async (req, res, next) => {
  try {
    if (!env.SARVAM_API_KEY) {
      return res.status(503).json({ error: "TTS is not configured" });
    }

    const parsed = bodySchema.parse(req.body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-subscription-key": env.SARVAM_API_KEY },
        body: JSON.stringify(parsed),
        signal: controller.signal
      });

      const text = await response.text();
      res.status(response.status).type("application/json").send(text);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return res.status(504).json({ error: "Sarvam TTS timed out" });
      }
      return res.status(502).json({ error: "Sarvam TTS is unreachable" });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    next(error);
  }
});
