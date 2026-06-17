# Dharma AI Backend

Production-ready TypeScript Express backend for the mobile app.

## Features

- Health endpoint
- YouTube search proxy endpoint
- AI chat proxy endpoint (OpenRouter)
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

- `YOUTUBE_API_KEY`
- `OPENROUTER_API_KEY` (optional if AI route not used)

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
