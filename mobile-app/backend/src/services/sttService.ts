import { env } from "../config/env";

export interface SttResult {
  transcript: string;
}

/**
 * Transcribes audio using Sarvam AI Speech-to-Text (saaras:v3).
 *
 * The audio is forwarded to Sarvam as multipart/form-data with the
 * `file` field, using the `api-subscription-key` header for auth.
 * Language is auto-detected by Sarvam (no explicit language_code sent).
 *
 * @param audioBuffer - Raw audio bytes (e.g. M4A/AAC from expo-av)
 * @param languageHint - Optional language hint ('en' | 'hi') for logging only
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  languageHint?: string
): Promise<SttResult> {
  if (!env.SARVAM_API_KEY) {
    throw new Error("SARVAM_API_KEY is not configured");
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Empty audio buffer");
  }

  const formData = new FormData();
  // Node's native FormData accepts a Uint8Array as a file part.
  formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/m4a" }), "recording.m4a");
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

  // Sarvam saaras:v3 returns { transcript: "..." }
  const transcript = (data as any).transcript || (data as any).text || "";

  if (!transcript || typeof transcript !== "string") {
    throw new Error("Empty transcript from Sarvam STT");
  }

  return { transcript: transcript.trim() };
}
