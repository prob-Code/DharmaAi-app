# DharmaAI: Inner Balance Companion

DharmaAI is a mental wellness and spiritual companion app with a React Native Expo mobile client and a TypeScript Express backend. The app combines AI chat, reflections, ambient audio, meditation video, community features, authentication, and real-time notifications.

## What this repository contains

This repository holds the full mobile experience and its backend API in one place. The mobile app is the main product surface, while the backend supports API routes, AI integration, health checks, and realtime features.

## Highlights

- AI-powered companion chat with voice input and text-to-speech.
- Reflections journaling with moods, likes, replies, and notifications.
- Ambient sound playback and guided media experiences.
- Meditation and video content browsing.
- Authentication with Supabase and OAuth redirect handling.
- Real-time messaging and community interactions.

## Requirements

- Node.js 18 or newer.
- npm.
- Expo CLI support through the local project scripts.
- Android Studio or Xcode if you want native builds.
- A Supabase project and any AI provider keys used by the app.

## Setup

Install dependencies for the mobile app:

```bash
cd mobile-app
npm install
```

Install dependencies for the backend:

```bash
cd mobile-app/backend
npm install
```

## Run the app

Start the Expo app:

```bash
cd mobile-app
npm run start
```

Run the web version:

```bash
cd mobile-app
npm run web
```

Run the Android build:

```bash
cd mobile-app
npm run android
```

Start the backend in development mode:

```bash
cd mobile-app/backend
npm run dev
```

## Backend scripts

- `npm run dev` starts the Express server with watch mode.
- `npm run build` compiles the TypeScript backend.
- `npm run start` runs the compiled server.
- `npm run typecheck` runs a backend type check.

## Configuration

Keep secrets in local environment files and do not commit them. The mobile app uses Expo and Supabase runtime configuration, while the backend reads its own environment variables from the local setup.

OAuth callback handling is configured for the custom scheme `dharmaai://auth-callback` and web redirects used during local development. For more backend-specific details, see [mobile-app/backend/README.md](mobile-app/backend/README.md).

## Notes

- This repo is organized as a single workspace with the mobile app at `mobile-app/` and the backend at `mobile-app/backend/`.
- Do not add secrets or generated build artifacts to version control.