import { env } from "../config/env";

// Provider call bound: a hung upstream must never hang the request.
// Shorter than the mobile client's TTS timeout so the backend returns a
// controlled 504 instead of the client seeing a raw abort.
const TTS_PROVIDER_TIMEOUT_MS = 12000;

export type TtsLanguage = "en" | "hi";
export type TtsVoiceSpeed = "very-slow" | "slow" | "normal";

// Voice-speed → pace mapping, preserved from the previous client-side flow.
const PACE_MAP: Record<TtsVoiceSpeed, number> = {
  "very-slow": 0.82,
  slow: 0.9,
  normal: 0.97,
};

export interface TtsInput {
  text: string;
  language?: TtsLanguage;
  voiceSpeed?: TtsVoiceSpeed;
}

export interface TtsResult {
  audioBase64: string;
}

/**
 * Synthesizes speech with Sarvam AI Text-to-Speech (bulbul:v3) server-side.
 *
 * The rendering parameters match the previous client-side flow exactly:
 * bulbul:v3 model, Hindi/English language mapping with speaker selection
 * (meera/amit), voice-speed pacing, 22050 Hz sample rate and preprocessing.
 *
 * Error contract (thrown as Error with `statusCode`):
 *  - not configured                          -> plain error (503 at route layer)
 *  - provider timeout                        -> 504
 *  - provider unreachable / malformed audio  -> 502
 *  - provider HTTP failure                   -> provider status passthrough
 *
 * Never logs the user text, the API key, or provider response bodies.
 */
export async function synthesizeSpeech(input: TtsInput): Promise<TtsResult> {
  if (!env.SARVAM_API_KEY) {
    throw new Error("SARVAM_API_KEY is not configured");
  }
  if (!input.text || input.text.trim().length === 0) {
    throw new Error("Text to synthesize is required");
  }

  const language: TtsLanguage = input.language ?? "en";
  const voiceSpeed: TtsVoiceSpeed = input.voiceSpeed ?? "slow";

  const payload = {
    inputs: [input.text.trim()],
    target_language_code: language === "hi" ? "hi-IN" : "en-IN",
    speaker: language === "hi" ? "meera" : "amit",
    pace: PACE_MAP[voiceSpeed],
    speech_sample_rate: 22050,
    enable_preprocessing: true,
    model: "bulbul:v3",
  };

  let response: Response;
  try {
    response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": env.SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TTS_PROVIDER_TIMEOUT_MS),
    });
  } catch (error: any) {
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const apiError = new Error(
      isTimeout ? "Sarvam TTS timed out" : "Sarvam TTS unreachable"
    ) as Error & { statusCode?: number };
    apiError.statusCode = isTimeout ? 504 : 502;
    throw apiError;
  }

  if (!response.ok) {
    // Consume and discard the provider body without logging it.
    await response.text().catch(() => "");
    const err = new Error(
      `Sarvam TTS provider error: ${response.status}`
    ) as Error & { statusCode?: number };
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json().catch(() => null);
  const audio =
    data && typeof data === "object" && Array.isArray((data as any).audios)
      ? (data as any).audios[0]
      : null;

  if (typeof audio !== "string" || audio.length === 0) {
    const err = new Error(
      "Malformed audio response from Sarvam TTS"
    ) as Error & { statusCode?: number };
    err.statusCode = 502;
    throw err;
  }

  return { audioBase64: audio };
}