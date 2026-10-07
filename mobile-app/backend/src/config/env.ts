import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("*"),
  SOCKET_CORS_ORIGIN: z.string().optional(),
  // Optional: only `/api/youtube/search` needs it. STT/AI deployments must be
  // able to boot without a YouTube key.
  YOUTUBE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("llama-3.3-70b-versatile"),
  SARVAM_API_KEY: z.string().optional(),
  // Server-side Supabase client configuration used to validate bearer access
  // tokens on protected routes (e.g. /api/ai/stt). These stay on the server
  // and are never shipped to the mobile app. Only the publishable anon key is
  // used for validation — the service_role key must NEVER be configured here.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
