import express, { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { getChatCompletion } from "../services/aiService";
import { transcribeAudio } from "../services/sttService";
import { synthesizeSpeech } from "../services/ttsService";

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

// Strict rate limiter for STT: 10 requests per minute per IP
const sttRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for speech-to-text" }
});

// Strict rate limiter for TTS: 30 requests per minute per IP
const ttsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for text-to-speech" }
});

// TTS input contract: bounded text, optional language and voice speed.
const ttsBodySchema = z.object({
  text: z.string().trim().min(1).max(1000),
  language: z.enum(["en", "hi"]).optional().default("en"),
  voiceSpeed: z.enum(["very-slow", "slow", "normal"]).optional().default("slow")
});

// Max audio payload: 5 MB multipart upload
const STT_MAX_BYTES = 5 * 1024 * 1024;

function parseMultipartFileBody(rawBody: Buffer, contentType: string) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = match ? (match[1] || match[2])?.trim() : null;

  if (!boundary) {
    throw new Error("Missing multipart boundary");
  }

  const boundaryMarker = Buffer.from(`--${boundary}`);
  let offset = rawBody.indexOf(boundaryMarker);

  if (offset < 0) {
    throw new Error("Invalid multipart payload");
  }

  let foundFilePart: { mimeType: string; fileName: string; content: Buffer } | null = null;

  while (offset >= 0) {
    offset = rawBody.indexOf(Buffer.from("\r\n"), offset + boundaryMarker.length);
    if (offset < 0) {
      break;
    }

    const headerStart = offset + 2;
    const headerEnd = rawBody.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd < 0) {
      break;
    }

    const headers = rawBody.subarray(headerStart, headerEnd).toString("utf8");
    const bodyStart = headerEnd + 4;
    const nextBoundary = rawBody.indexOf(boundaryMarker, bodyStart);
    if (nextBoundary < 0) {
      break;
    }

    const fileContent = rawBody.subarray(bodyStart, nextBoundary - 2);
    const disposition = headers.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (disposition) {
      const [, fieldName, fileName] = disposition;
      const mimeTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1].trim() : "application/octet-stream";

      if (fieldName === "file") {
        foundFilePart = {
          mimeType,
          fileName: fileName || "recording.bin",
          content: fileContent
        };
        break;
      }
    }

    offset = nextBoundary;
  }

  if (!foundFilePart) {
    throw new Error("No file part found in multipart upload");
  }

  return foundFilePart;
}

function isEmptyTranscript(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length === 0 ||
    /^(silence|no speech|no audio|empty|undefined|null)$/.test(normalized.toLowerCase())
  );
}

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

aiRouter.post("/stt", requireAuth, sttRateLimiter, express.raw({ type: "multipart/form-data", limit: "6mb" }), async (req, res, next) => {
  try {
    if (!env.SARVAM_API_KEY) {
      return res.status(503).json({ error: "SARVAM_API_KEY is not configured" });
    }

    if (!req.is("multipart/form-data")) {
      return res.status(415).json({ error: "Multipart form-data is required" });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");
    const contentType = req.get("content-type") || "";

    if (rawBody.length === 0) {
      return res.status(400).json({ error: "Empty audio recording" });
    }
    if (rawBody.length > STT_MAX_BYTES) {
      return res.status(413).json({ error: "Audio file too large" });
    }

    const uploadedFile = parseMultipartFileBody(rawBody, contentType);
    if (uploadedFile.mimeType && !uploadedFile.mimeType.startsWith("audio/")) {
      return res.status(400).json({ error: "Uploaded file must be audio" });
    }
    if (uploadedFile.content.length === 0) {
      return res.status(400).json({ error: "Empty audio recording" });
    }
    if (uploadedFile.content.length > STT_MAX_BYTES) {
      return res.status(413).json({ error: "Audio file too large" });
    }

    const result = await transcribeAudio(uploadedFile.content, uploadedFile.mimeType || "audio/m4a");

    if (isEmptyTranscript(result.transcript)) {
      return res.status(422).json({ error: "No speech detected in audio" });
    }

    // No audio persistence — transcript is returned, file is discarded
    res.json({ transcript: result.transcript.trim() });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

// Authenticated Sarvam text-to-speech. `requireAuth` runs first so
// unauthenticated calls never reach the provider. Returns base64 audio that
// the mobile client plays locally; the Sarvam API key never leaves the server.
aiRouter.post("/tts", requireAuth, ttsRateLimiter, async (req, res, next) => {
  try {
    if (!env.SARVAM_API_KEY) {
      return res.status(503).json({ error: "SARVAM_API_KEY is not configured" });
    }

    const parsed = ttsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid TTS request",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const result = await synthesizeSpeech(parsed.data);
    res.json({ audio: result.audioBase64 });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});
