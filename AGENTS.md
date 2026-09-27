# ANANTA Agent Operating Rules

## Scope and Repository Boundaries

- This file governs the parent DharmaAI repository only.
- `The-Chat_Rag/` and `ai-infra-intelligence/` are independent nested Git repositories. Do not modify, stage, commit, branch, reset, or clean their contents from the parent repository.
- Treat `mobile-app/`, `mobile-app/backend/`, and `stress-analyzer/` as parent-repository areas with their scoped instructions.
- Inspect repository root, branch, and status before editing. Preserve all existing user changes.

## Agent Responsibilities

- **COPILOT PLAN:** Read-only architecture and implementation planning. Do not edit files, install packages, start services, access secrets, or access participant/research data.
- **CLINE:** Primary implementation agent after an approved plan. Make only approved, minimal changes and validate them.
- **OPENCODE:** Optional independent, read-only reviewer. Review diffs, tests, security, and repository boundaries without modifying the tree.

## Inspect Before Edit

- Identify the owning repository and nearest controlling code path before changing anything.
- Read relevant local instructions, neighboring implementations, and tests first.
- Form a falsifiable local hypothesis and choose the narrowest useful validation.
- Do not broaden scope or refactor unrelated code.

## Change Discipline

- Prefer minimal, targeted edits and preserve existing interfaces.
- One feature, one branch, one checkpoint at a time.
- Never use `git add .` blindly.
- Never force push, reset, clean, or discard unrelated user work.
- Do not create worktrees unless explicitly approved.
- Parent and nested repositories are independent and must be handled separately.

## Git Checkpoints

- Work on a feature branch, never directly on `main`.
- Before meaningful implementation, create a checkpoint commit in the owning repository after confirming the worktree is understood.
- Test before committing.
- Create a post-change checkpoint after validation.
- Do not commit automatically unless explicitly requested.

## Security and Sensitive Data

- Never print, copy, transmit, or expose secret values, API keys, tokens, credentials, or session tokens.
- Never inspect or transmit participant records, research exports, direct identifiers, chat-history dumps, or production database contents.
- Use synthetic or redacted fixtures only.
- Treat `.env` files, Supabase service credentials, storage credentials, vector metadata, and research source documents as inaccessible.
- Do not modify Supabase schema, data, RLS, realtime, or storage configuration without explicit human approval.

## ANANTA Research Constraints

- ADSS is screening and identification only.
- A participant selects exactly one intervention domain.
- Use one psychological test per domain.
- The intervention has three sessions.
- Preserve the sequence: pre-test -> Session 1 -> Session 2 -> Session 3 -> post-test.
- Gita mapping is conceptual and thematic, not clinical.
- Do not make diagnosis, treatment, or cure claims.
- Do not use a Krishna chatbot persona.
- Personalization means structured context and state, never model-weight retraining from participant data.
- Do not change research methodology without explicit human approval.

## Product and UI

- Follow the voice-first product direction where relevant, while preserving existing platform boundaries.
- Keep the UI human-first and calm; avoid generic AI-dashboard styling, excessive neon, and glassmorphism.
- Keep user-facing mental-wellness language non-clinical and appropriately bounded.

## Validation

- Run the narrowest relevant test, typecheck, lint, or build after changes.
- Run broader validation only when the change has cross-component impact.
- Report validation results and any unavailable checks clearly.
