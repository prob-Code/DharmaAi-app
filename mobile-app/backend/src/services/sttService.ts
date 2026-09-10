import { env } from "../config/env";

export interface SttResult {
  transcript: string;
}

function isEmptyTranscript(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length === 0 ||
    /^(silence|no speech|no audio|empty|undefined|null)$/.test(normalized.toLowerCase())
  );
}

/**
 * Transcribes audio using Sarvam AI Speech-to-Text (saaras:v3).
 *
 * The audio is forwarded to Sarvam as multipart/form-data with the
 * `file` field, using the `api-subscription-key` header for auth.
 * Language is auto-detected by Sarvam (no explicit language_code sent).
 *
 * @param audioBuffer - Raw audio bytes (e.g. M4A/AAC from expo-av)
 * @param mimeType - Audio MIME type from the uploaded file
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/m4a"
): Promise<SttResult> {
  if (!env.SARVAM_API_KEY) {
    throw new Error("SARVAM_API_KEY is not configured");
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Empty audio buffer");
  }

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), "recording.m4a");
  formData.append("model", "saaras:v3");

  const response = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      "api-subscription-key": env.SARVAM_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    const err = new Error(
      `Sarvam STT error: ${response.status} ${errorText}`
    ) as Error & { statusCode?: number };
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json().catch(() => null);

  if (!data || typeof data !== "object") {
    throw new Error("Malformed response from Sarvam STT");
  }

  const transcript = (data as any).transcript ?? (data as any).text ?? "";

  if (typeof transcript !== "string" || isEmptyTranscript(transcript)) {
    const err = new Error("No speech detected in audio") as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }

  return { transcript: transcript.trim() };
}
