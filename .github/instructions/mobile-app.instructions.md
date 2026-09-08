---
applyTo: "mobile-app/**/*.{ts,tsx}"
---

# Mobile App Instructions

- Preserve the existing Expo React Native and web architecture.
- Keep changes scoped to the requested mobile behavior; do not modify backend, RAG, stress-analyzer, or nested-repository code unless explicitly approved.
- Inspect the owning component, service, context, and nearby tests before editing.
- Preserve explicit web-versus-native behavior and existing platform fallbacks.
- Treat Supabase Auth, database, realtime, storage, and AsyncStorage session handling as security-sensitive boundaries.
- Never print or expose API keys, tokens, session values, or `.env` contents.
- Never send participant or research data to an agent. Use synthetic or redacted fixtures only.
- Follow the voice-first product direction, but do not claim that TTS is STT or invent an unimplemented transcription path.
- Keep the UI human-first and calm. Avoid generic AI-dashboard styling, excessive neon, glassmorphism, diagnosis claims, treatment claims, cure claims, and a Krishna chatbot persona.
- Personalization must use structured context or state; never implement model-weight retraining from participant data.
- Run the narrowest relevant validation after edits. Do not install packages or start servers unless explicitly requested.
