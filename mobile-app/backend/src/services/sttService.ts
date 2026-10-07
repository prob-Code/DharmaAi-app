import { env } from "../config/env";

// Provider call bound: shorter than the mobile client's 15s timeout so the
// backend returns a controlled 504 instead of the client seeing a raw abort.
const STT_PROVIDER_TIMEOUT_MS = 12000;

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
 * Timeout contract: provider calls are bounded by STT_PROVIDER_TIMEOUT_MS so
 * a hung upstream never hangs the request — a timeout surfaces as a
 * retryable 504, and an unreachable provider as a controlled 502.
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

  let response: Response;
  try {
    response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": env.SARVAM_API_KEY,
      },
      body: formData,
      signal: AbortSignal.timeout(STT_PROVIDER_TIMEOUT_MS),
    });
  } catch (error: any) {
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const apiError = new Error(
      isTimeout ? "Sarvam STT timed out" : "Sarvam STT unreachable"
    ) as Error & { statusCode?: number };
    apiError.statusCode = isTimeout ? 504 : 502;
    throw apiError;
  }

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
