# Project Guidelines

## Scope
- This workspace is a small monorepo with a React Native Expo app in `mobile-app/` and a TypeScript Express backend in `mobile-app/backend/`.
- Prefer minimal, targeted edits. Do not reformat unrelated code.

## Build and Run
- Mobile app install: `cd mobile-app && npm install`
- Mobile app dev server: `cd mobile-app && npm run start`
- Mobile app web: `cd mobile-app && npm run web`
- Mobile app Android: `cd mobile-app && npm run android`
- Backend install: `cd mobile-app/backend && npm install`
- Backend dev server: `cd mobile-app/backend && npm run dev`
- Backend typecheck: `cd mobile-app/backend && npm run typecheck`
- Backend build/start: `cd mobile-app/backend && npm run build && npm run start`

Important:
- Run Expo commands from `mobile-app/`, not workspace root.
- Run backend commands from `mobile-app/backend/`.

## Architecture
- Mobile app entry point is `mobile-app/App.tsx`.
- Main app tabs are companion chat, reflections, and videos.
- Core mobile domains:
  - UI components in `mobile-app/components/`
  - Context providers in `mobile-app/context/`
  - Supabase/auth/data services in `mobile-app/services/`
  - Shared types in `mobile-app/src/types/` and `mobile-app/types/`
- Backend entry points are `mobile-app/backend/src/index.ts` and `mobile-app/backend/src/app.ts`.
- Backend API routes are split by domain under `mobile-app/backend/src/routes/` (`health`, `youtube`, `ai`), with middleware in `mobile-app/backend/src/middleware/`.

## Conventions
- Use TypeScript and functional React components.
- Preserve existing naming and file organization patterns; prefer adding to existing service/context modules instead of creating parallel abstractions.
- Keep request validation and error handling centralized in backend route/middleware patterns already present.
- Keep platform-specific behavior explicit (for example web vs native checks in Expo code).

## Security and Config
- Do not introduce new hardcoded secrets, API keys, or tokens.
- Prefer environment variables (backend) and secure runtime config patterns (mobile) when touching auth or API integration code.
- If a task involves credentials, update docs or placeholders rather than committing real secrets.

## Link, Don't Embed
- For backend API and setup details, see `mobile-app/backend/README.md`.
- For app feature context and status history, see `COMPLETE_APP_REPORT.md`, `WORK_REPORT.md`, and `mobile-app/FIXES.md`.
- For API key setup guidance, see `mobile-app/API_KEY_SETUP.md`.