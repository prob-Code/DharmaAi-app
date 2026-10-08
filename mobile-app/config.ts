
import { Platform } from 'react-native';

// Configure your API keys through Expo public env vars.
// In production, these should be set in EAS Secrets or .env file.
// NEVER commit actual API keys to source control.
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const SARVAM_API_KEY = process.env.EXPO_PUBLIC_SARVAM_API_KEY ?? "";
const STRESS_API_KEY = process.env.EXPO_PUBLIC_STRESS_API_KEY ?? "";
const STRESS_API_URL = process.env.EXPO_PUBLIC_STRESS_API_URL ?? "https://agentcrafter-dharmaai-stress-analyzer.hf.space";

// ─── Supabase client project resolution ─────────────────────────────────────
// Release/production builds MUST resolve the Supabase project from environment
// (EAS environment variables / secrets). There is deliberately no production
// fallback: an AAB must never silently target the legacy/dev project.
//
// Development builds (Expo Go, `expo run:*` dev, Node test runs where __DEV__
// is absent) may fall back to the legacy dev project so local work keeps
// working without a .env — that branch is compiled out of release builds via
// Metro's statically-replaced __DEV__ flag.
const isProductionBuild = typeof __DEV__ !== 'undefined' ? !__DEV__ : false;

const DEV_SUPABASE_URL = 'https://mtiltptnumjoaibgpvzb.supabase.co';
const DEV_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aWx0cHRudW1qb2FpYmdwdnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzU1MTAsImV4cCI6MjA4NjcxMTUxMH0.vfzZ-I306Xb0RIGYLYGSoa-96FtjAOqQlnTgoDTkyVY';

function resolveSupabaseProject(): { url: string; anonKey: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    return { url, anonKey };
  }

  if (isProductionBuild) {
    throw new Error(
      'Supabase client configuration missing for production. Set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY via EAS ' +
        'environment variables / secrets, then rebuild. Refusing to start ' +
        'against a non-production Supabase project.'
    );
  }

  // Development-only fallback — isolated from production builds.
  console.warn(
    '[config] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set; ' +
      'using the legacy development Supabase project. Set both in .env to target another project.'
  );
  return { url: DEV_SUPABASE_URL, anonKey: DEV_SUPABASE_ANON_KEY };
}

const supabaseProject = resolveSupabaseProject();
const SUPABASE_URL = supabaseProject.url;
const SUPABASE_ANON_KEY = supabaseProject.anonKey;

// ─── Backend service URL resolution ───────────────────────────────────────
// Production/release builds MUST resolve the backend from the environment.
// There is deliberately no placeholder fallback: an AAB must never silently
// point at a dead host (STT + realtime depend on this URL). Development
// builds fall back to the local backend so local work keeps working.
function resolveBackendUrl(): string {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (url && !url.includes('your-production-backend')) {
    return url;
  }
  if (isProductionBuild) {
    throw new Error(
      'Backend configuration missing for production. Set EXPO_PUBLIC_BACKEND_URL ' +
        'via EAS environment variables / secrets, then rebuild. Refusing to ' +
        'start against a placeholder backend host.'
    );
  }
  console.warn(
    '[config] EXPO_PUBLIC_BACKEND_URL not set; using the local backend. ' +
      'Set it in .env to target another backend.'
  );
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

const BACKEND_URL = resolveBackendUrl();

export const Config = {
    GROQ_API_KEY,
    GEMINI_API_KEY,
    SARVAM_API_KEY,
    STRESS_API_KEY,
    STRESS_API_URL,
    BACKEND_URL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY
};

