# Dharma AI Backend

Production-ready TypeScript Express backend for the mobile app.

## Features

- Health endpoint
- YouTube search proxy endpoint
- AI chat proxy endpoint (Groq)
- Stress analysis and Sarvam TTS proxy endpoints
- Socket.IO realtime server for live events
- Firebase-authenticated Supabase social data bridge
- Input validation with Zod
- Security middleware (Helmet, CORS, rate-limiting)
- Centralized error handling

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

1. Fill in environment values in `.env`:

- `YOUTUBE_API_KEY`
- `GROQ_API_KEY` (optional if AI route not used)
- `SARVAM_API_KEY` and `STRESS_API_KEY` (optional if those routes are not used)
- `CORS_ORIGIN` (required; use the deployed app origin, not `*` in production)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` for Firebase Admin token verification
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for server-only social data access

1. Install dependencies:

```bash
npm install
```

1. Run in dev mode:

```bash
npm run dev
```

1. Build and run production:

```bash
npm run build
npm start
```

## API Endpoints

- `GET /api/health`
- `GET /api/youtube/search?q=meditation&maxResults=12&language=en`
- `POST /api/ai/chat`
- `POST /api/stress/analyze`
- `POST /api/tts/sarvam`
- `GET|POST /api/social/posts`
- `POST /api/social/posts/:postId/likes/toggle`
- `GET|POST /api/social/posts/:postId/comments`
- `GET|POST /api/social/messages`
- `GET|POST /api/social/communities`

Social endpoints require `Authorization: Bearer <Firebase ID token>`. Never put
`SUPABASE_SERVICE_ROLE_KEY` or Firebase Admin credentials in the mobile app.

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
