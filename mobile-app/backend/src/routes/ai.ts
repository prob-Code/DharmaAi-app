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

// Strict rate limiter for STT: 10 requests per minute per IP
const sttRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for speech-to-text" }
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

aiRouter.post("/stt", sttRateLimiter, express.raw({ type: "multipart/form-data", limit: "6mb" }), async (req, res, next) => {
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
