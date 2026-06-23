
// Configure your API keys through Expo public env vars or secure runtime config.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const SARVAM_API_KEY = process.env.EXPO_PUBLIC_SARVAM_API_KEY ?? "";
const RAGGITA_API_KEY = process.env.EXPO_PUBLIC_RAGGITA_API_KEY ?? "rg_gita_d8b3c9f2a71e4a5091bfbc";
const STRESS_API_KEY = process.env.EXPO_PUBLIC_STRESS_API_KEY ?? "stress_dharma_2026_securef2a71e4a5091bfbc";
const STRESS_API_URL = process.env.EXPO_PUBLIC_STRESS_API_URL ?? "https://agentcrafter-dharmaai-stress-analyzer.hf.space";
const BACKEND_URL = "http://localhost:4000";

export const Config = {
    GROQ_API_KEY,
    GEMINI_API_KEY,
    SARVAM_API_KEY,
    RAGGITA_API_KEY,
    STRESS_API_KEY,
    STRESS_API_URL,
    BACKEND_URL
};

