
// Configure your API keys through Expo public env vars.
// In production, these should be set in EAS Secrets or .env file.
// NEVER commit actual API keys to source control.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const SARVAM_API_KEY = process.env.EXPO_PUBLIC_SARVAM_API_KEY ?? "";
const RAGGITA_API_KEY = process.env.EXPO_PUBLIC_RAGGITA_API_KEY ?? "";
const STRESS_API_KEY = process.env.EXPO_PUBLIC_STRESS_API_KEY ?? "";
const STRESS_API_URL = process.env.EXPO_PUBLIC_STRESS_API_URL ?? "https://agentcrafter-dharmaai-stress-analyzer.hf.space";
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "https://your-production-backend.com";

export const Config = {
    GROQ_API_KEY,
    GEMINI_API_KEY,
    SARVAM_API_KEY,
    RAGGITA_API_KEY,
    STRESS_API_KEY,
    STRESS_API_URL,
    BACKEND_URL
};

