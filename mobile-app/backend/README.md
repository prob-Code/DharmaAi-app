# Dharma AI Backend

Production-ready TypeScript Express backend for the mobile app.

## Features

- Health endpoint
- YouTube search proxy endpoint
- AI chat proxy endpoint (OpenRouter)
- Speech-to-text endpoint (Sarvam `saaras:v3`)
- Text-to-speech endpoint (Sarvam `bulbul:v3`, authenticated, server-side key)
- Socket.IO realtime server for live events
- Input validation with Zod
- Security middleware (Helmet, CORS, rate-limiting)
- Centralized error handling

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill in environment values in `.env`:

- `PORT` (default `4000`)
- `NODE_ENV` (`development` | `test` | `production`)
- `CORS_ORIGIN` (allowed origin; default `*`)
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` (required to validate bearer tokens on the authenticated `/api/ai/stt` route; publishable anon key only — never the `service_role` key)
- `SARVAM_API_KEY` (required for the `/api/ai/stt` speech-to-text and `/api/ai/tts` text-to-speech routes)
- `OPENROUTER_API_KEY` (optional if AI route not used)
- `YOUTUBE_API_KEY` (only required if the YouTube search proxy is used)

See `.env.example` for the full template.

3. Install dependencies:

```bash
npm install
```

4. Run in dev mode:

```bash
npm run dev
```

5. Build and run production:

```bash
npm run build
npm start
```

## API Endpoints

- `GET /api/health`
- `GET /api/youtube/search?q=meditation&maxResults=12&language=en`
- `POST /api/ai/chat`
- `POST /api/ai/stt` (multipart `file` field, max ~5 MB audio; requires `Authorization: Bearer <Supabase access token>`)
- `POST /api/ai/tts` (JSON `{ "text": string (1–1000 chars), "language"?: "en"|"hi", "voiceSpeed"?: "very-slow"|"slow"|"normal" }` → `{ "audio": "<base64>" }`; requires `Authorization: Bearer <Supabase access token>`, rate-limited)

## Authentication

The protected routes (`POST /api/ai/stt`, `POST /api/ai/tts`) require the mobile
app's authenticated Supabase session token:

```
Authorization: Bearer <supabase-access-token>
```

The backend validates the token against the existing Supabase auth
infrastructure (`GET {SUPABASE_URL}/auth/v1/user`) using the publishable anon
key — no service-role or private credential is used or exposed.

Error contract:

- missing/invalid/expired token -> `401`
- authenticated but forbidden   -> `403`
- server auth not configured    -> `503`
- auth service timeout          -> `504`
- provider (Sarvam) failure     -> controlled `5xx` (`502` unreachable / `504` timeout / provider status passthrough)

## Realtime Events (Socket.IO)

Client emits:

- `user:join` with `userId`
- `dm:send` with direct-message payload
- `notification:send` with notification payload

Server emits:

- `dm:new`
- `notification:new`

Example AI request body:

```json
{
  "messages": [
    { "role": "system", "content": "You are a calm guide." },
    { "role": "user", "content": "I feel anxious" }
  ]
}
```
