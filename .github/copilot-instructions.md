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

## Agent Operating Rules

### Responsibilities
- **COPILOT PLAN:** Read-only architecture and research planner. Do not edit files, install packages, start services, access secrets, or access participant/research data.
- **CLINE:** Primary implementation agent after an approved plan. Make only minimal, approved changes and validate them.
- **OPENCODE:** Optional independent, read-only reviewer. Review diffs, tests, security, and repository boundaries without modifying the tree.

### Inspect Before Edit
- Verify the owning repository root, branch, and current status before editing.
- Read the applicable instructions, nearby implementation, and relevant tests first.
- Identify the controlling code path and choose the narrowest useful validation.
- Preserve all existing user changes and do not broaden scope into unrelated refactors.

### Security and Sensitive Data
- Never print, copy, transmit, or expose secret values, API keys, tokens, credentials, session values, or `.env` contents.
- Never inspect or transmit participant records, research exports, direct identifiers, chat-history dumps, or production database contents.
- Use synthetic or redacted fixtures only.
- Do not modify Supabase schema, data, RLS, realtime, or storage configuration without explicit human approval.
- Do not add hardcoded credentials; use environment variables and safe placeholders.

### ANANTA Research and Product Rules
- ADSS is screening and identification only.
- A participant selects exactly one intervention domain.
- Use one psychological test per domain.
- The intervention has three sessions; preserve: pre-test -> Session 1 -> Session 2 -> Session 3 -> post-test.
- Gita mapping is conceptual and thematic, not clinical.
- Do not make diagnosis, treatment, or cure claims.
- Do not use a Krishna chatbot persona.
- Personalization means structured context/state, never model-weight retraining from participant data.
- Follow the voice-first product direction where relevant.
- Keep the UI human-first and calm; avoid generic AI-dashboard styling, excessive neon, and glassmorphism.
- Do not change research methodology without explicit human approval.

### Git and Change Discipline
- Parent and nested repositories are independent. Do not modify, stage, commit, branch, reset, or clean `The-Chat_Rag/` or `ai-infra-intelligence/` from the parent repository.
- Use one feature, one branch, and one checkpoint at a time.
- Never use `git add .` blindly.
- Never force push, reset, clean, or discard unrelated user work.
- Test before commit. Create a checkpoint before meaningful implementation and after validated work.
- Do not commit automatically unless explicitly requested.

### Testing
- Run the narrowest relevant test, typecheck, lint, or build after changes.
- Run broader validation only for cross-component changes.
- Report unavailable validation clearly.