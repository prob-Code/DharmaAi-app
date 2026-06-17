
// Configure your API keys through Expo public env vars or secure runtime config.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const SARVAM_API_KEY = process.env.EXPO_PUBLIC_SARVAM_API_KEY ?? "";
const BACKEND_URL = "http://localhost:4000";

export const Config = {
    GROQ_API_KEY,
    GEMINI_API_KEY,
    SARVAM_API_KEY,
    BACKEND_URL
};

