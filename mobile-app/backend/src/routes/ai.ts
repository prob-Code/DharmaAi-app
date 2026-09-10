import express, { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { getChatCompletion } from "../services/aiService";
import { transcribeAudio } from "../services/sttService";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1)
});

const sttBodySchema = z.object({
  audio: z.string().min(1, "audio (base64) is required"),
  language: z.enum(["en", "hi"]).optional()
});

// Strict rate limiter for STT: 10 requests per minute per IP
const sttRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for speech-to-text" }
});

// Max audio payload: 5 MB (base64-encoded JSON body)
const STT_MAX_BYTES = 5 * 1024 * 1024;

export const aiRouter = Router();

aiRouter.post("/chat", async (req, res, next) => {
  try {
    if (!env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: "OPENROUTER_API_KEY is not configured" });
    }

    const parsed = bodySchema.parse(req.body);

    const text = await getChatCompletion({
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      messages: parsed.messages
    });

    res.json({ text });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/stt", sttRateLimiter, express.json({ limit: "6mb" }), async (req, res, next) => {
  try {
    if (!env.SARVAM_API_KEY) {
      return res.status(503).json({ error: "SARVAM_API_KEY is not configured" });
    }

    const parsed = sttBodySchema.parse(req.body);

    // Decode base64 audio
    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(parsed.audio, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 audio data" });
    }

    // Strict file-size check (decoded bytes)
    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: "Empty audio recording" });
    }
    if (audioBuffer.length > STT_MAX_BYTES) {
      return res.status(413).json({ error: "Audio file too large" });
    }

    const result = await transcribeAudio(audioBuffer, parsed.language);

    // No audio persistence — transcript is returned, file is discarded
    res.json({ transcript: result.transcript });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});
