---
applyTo: "mobile-app/backend/**/*.{ts,tsx}"
---

# Backend Instructions

- Preserve the existing TypeScript Express and Socket.IO architecture.
- Keep API validation, security middleware, error handling, and route ownership consistent with local patterns.
- Inspect the route, service, environment schema, and relevant tests before editing.
- Keep backend changes separate from the mobile app, stress-analyzer, and nested repositories.
- Never print or expose API keys, tokens, credentials, session values, or `.env` contents.
- Do not add hardcoded secrets. Use environment variables and safe placeholders only.
- Never inspect, log, store, or transmit participant/research records or chat-history dumps.
- Use synthetic or redacted fixtures for tests.
- Do not change Supabase schema, production data, RLS, realtime, or storage behavior without explicit human approval.
- Preserve non-clinical language and the ANANTA research constraints; do not introduce diagnosis, treatment, cure, or Krishna chatbot claims.
- Run the narrowest relevant typecheck or test after edits. Do not install packages or start servers unless explicitly requested.
