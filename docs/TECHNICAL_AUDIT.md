# FRA Atlas / Adi-bandhu — Technical Audit and Play Store Readiness

**Audit date:** 2026-10-11  
**Scope:** repository architecture, runtime wiring visible in source, service activation, security posture, mobile distribution readiness and launch plan  
**Conclusion:** **Not ready for production or Google Play submission.** The current repository is a responsive web/PWA prototype with partial Supabase wiring. It is not yet an Android project and several screens intentionally use demo or placeholder behavior.

## 1. Executive risk summary

| Priority | Finding | Why it matters | Gate |
|---|---|---|---|
| P0 | No native Android project, package ID, Gradle build, signing or App Bundle | There is no Play-uploadable artifact | Play Store blocker |
| P0 | `.env` is committed and contains a live-looking Supabase anon key plus placeholder third-party keys | Credentials/configuration are exposed in source and environment handling is unsafe | Security blocker |
| P0 | Signup accepts roles such as Administrator and Committee Member | A public user can request a privileged role; browser role routing is not authorization | Security/data-integrity blocker |
| P0 | Core workflows are mostly UI-local and demo-backed | Upload, review, voting and map claims cannot be trusted as durable transactions | Product blocker |
| P0 | No database migrations/RLS/storage/functions in the repo | Supabase runtime contract is undeclared and cannot be reproduced or audited | Operations blocker |
| P1 | Live data silently falls back to hard-coded demo data | Users can mistake stale/demo metrics for real government records | Trust/reliability risk |
| P1 | Maps and weather/system status include placeholder/simulated values | Screens report services as active without a real health/data contract | Reliability risk |
| P1 | No tests, lint script, CI, crash monitoring or release pipeline | Regressions and Play review failures are likely | Quality blocker |
| P1 | Privacy policy, data deletion/export, consent and Data Safety evidence are absent | Required for an app handling identity, documents, location or analytics | Compliance blocker |
| P2 | Large feature surface is duplicated and page-local | High maintenance cost and inconsistent behavior | Optimization |
| P2 | Deployment configuration may publish the wrong Vite output directory | Deployments can be empty or stale | Release risk |

## 2. Evidence-based findings

### A. This is not yet a mobile app

Evidence: `package.json` contains React/Vite web dependencies and no Android Gradle, Kotlin, Java, Capacitor, Cordova or React Native setup. `public/manifest.json` and service-worker registration provide PWA behavior only. Vercel and Netlify configuration provide static web hosting.

Recommendation:

1. **PWA wrapper (fastest):** deploy a production HTTPS PWA, then package it with Trusted Web Activity/Bubblewrap only after offline/auth/upload/GIS behavior is verified.
2. **Capacitor shell (pragmatic):** keep the React UI, add a native Android project, deep links, secure storage, file/camera/location plugins, offline queue and Android release configuration.
3. **Native rebuild (highest control):** rebuild the field experience in Kotlin/Jetpack Compose while sharing the API/domain contract.

For this product, the recommended path is a staged Capacitor shell for an MVP, with a later native field module if offline GIS, document capture and device integration become central. Android’s architecture guidance recommends layered UI/data design and unidirectional data flow; the mobile shell should preserve that separation. See the [Android architecture guidance](https://developer.android.com/topic/architecture).

### B. Authentication and authorization are unsafe for production

Evidence:

- `Signup.jsx` stores the selected role in `user_metadata`, including `Administrator` and `Committee Member`.
- `ProtectedRoute.jsx` checks only that a session exists.
- `roleRouting.js` routes from client metadata.
- `multi-role-dashboard/index.jsx` includes a role selector and accepts a URL query `?r=`.

Why this fails: client metadata and route parameters are user-controlled. They may influence the UI, but they must never grant permission to read or mutate protected claims.

Fix:

- Remove privileged roles from self-signup; new users receive a least-privilege pending role.
- Maintain role/organization membership in a server-controlled table or JWT custom claims.
- Enforce Supabase Row Level Security on every business table and storage object.
- Use server-side policies for claim ownership, geographic scope, committee membership and transitions.
- Replace the demo role selector with a permission-derived selector and audit every role change.
- Add MFA for administrators and committee members where appropriate.
- Add session timeout, refresh/error handling, account recovery and verified-email policy.

### C. “Services” are not active services yet

| Service | Current implementation | Failure mode | Activation work |
|---|---|---|---|
| Auth | Supabase Auth session and OAuth calls | Missing provider config, redirect mismatch or invalid env gives blank/loading behavior | Configure production project, redirect URLs, email templates, verified domain, recovery, MFA and error telemetry |
| Database | Dashboard count queries only | Missing tables/columns/RLS returns `null`, then demo numbers appear | Add migrations, constraints, indexes, RLS policies, seed data and integration tests |
| Claims | UI forms and local state | No durable create/update workflow is demonstrated | Create claims API/RPC, validation, status state machine, idempotency and audit events |
| Document storage | UI upload components exist | No bucket/policy/scanning/retention contract is in repo | Private bucket, signed URLs, scan/quarantine, limits, encryption, retention and delete/export flow |
| GIS | Google Maps iframe plus simulated rectangles; MapLibre dependencies | No authoritative layer or geospatial service | Choose provider, configure keys, publish versioned layers, add geospatial queries and public redaction |
| Search/geocoding | UI-level search panels | No reliable endpoint/rate limits/error state | Add server proxy/provider, debounce, quotas, caching and privacy-safe logs |
| Weather | Hard-coded `28°C`, `Partly Cloudy`, `Khandwa, MP` | Always looks healthy and current when it is not | Remove until real provider is wired, or add timestamp/source/health state |
| News/schemes/links/gallery | Optional `VITE_API_BASE` with silent static fallback | API outage is hidden | Define API schema, timeout, retry, stale-cache indicator and admin content ownership |
| Notifications | Panels/components | No durable delivery, read state or push registration | Add notification table/outbox, FCM/Web Push strategy and delivery telemetry |
| DSS | Rule-based local `dss.js` | Recommendations are not versioned or persisted | Version rules, record inputs/reasons, human override, legal review and test fixtures |
| Analytics/ads/payments/AI | Placeholder env names only | False sense of activation and risk of leaking secrets | Remove unused variables; add each integration only with privacy review and server-side secrets |

### D. Demo fallback hides outages

`src/services/dashboardData.js` returns hard-coded role metrics if any live count fails. `src/utils/dataProviders.js` does the same for content endpoints. This is acceptable for a prototype but unsafe for an official service.

Fix the contract to return `{status: 'live'|'stale'|'offline', data, source, updatedAt, errorId}`. Render a visible “demo/stale/offline” state, never silently replace authoritative data with fixed numbers. Add synthetic health checks for auth, database, storage, map tiles, API and notifications.

### E. Workflow persistence and auditability are missing

The claim upload, verification and committee review screens contain rich presentation logic, but the repository does not show a complete server-backed transaction for creating a claim, storing immutable evidence metadata, assigning a verifier, recording checklist outcomes, committee quorum/votes, approving/rejecting with a reason, publishing a redacted public claim, notifying affected users, or retaining a tamper-evident audit trail.

Implement a workflow state machine on the server. Example statuses: `draft -> submitted -> assigned -> in_verification -> committee_pending -> approved|rejected|returned`. Reject invalid transitions server-side. Use an append-only audit event table with actor, role, timestamp, request ID, old/new state, reason and affected entity.

### F. Security and privacy gaps

- The committed `.env` must be removed from Git history and all exposed credentials rotated. A browser Supabase anon key is not a substitute for RLS; placeholder API key names should not be shipped.
- Never ship OpenAI/Gemini/Anthropic/Perplexity/Stripe secret keys in Vite variables. Use server-side edge functions or a backend secret manager.
- Replace external image URLs and remote Google/logo resources with approved, versioned assets where possible; add CSP and integrity controls.
- Define whether documents contain identity, land, location, tribal or other sensitive data. Apply minimization, encryption, access logging, retention and deletion/export rules.
- Add an in-app privacy policy and account/data deletion path. Complete Play Console Data Safety accurately, including SDK behavior. See [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) and [User data](https://support.google.com/googleplay/android-developer/answer/10144311).
- Add prominent disclosure and consent before sensitive permissions such as location, camera or file access; see [Google Play disclosure guidance](https://support.google.com/googleplay/android-developer/answer/11150561).

### G. Build and release hygiene

- `package.json` has no lint/test scripts even though testing dependencies are present.
- The README describes folders and features that do not all exist, reducing its value as engineering documentation.
- `vercel.json` and `netlify.toml` publish `build`; Vite normally emits `dist`. Align `build.outDir` or deployment publish settings and verify with a clean deployment.
- Add lockfile, Node version pin, dependency audit, SAST, secret scan and CI build.
- Add error-boundary reporting rather than a generic error only.
- Add route-level loading states instead of `Suspense fallback={null}`.
- Replace `window.location.href` internal navigation with React Router navigation to preserve SPA state and avoid full reloads.
- Define responsive breakpoints and test dense dashboard/map layouts on small devices; several screens are designed primarily for large desktop grids.

## 3. Recommended target architecture

```text
Android app (Capacitor now; native field modules later)
        |
        +-- UI: route screens, accessible components, state holders
        +-- domain: claim workflow, permissions, DSS, validation
        +-- data: typed API client, cache, offline queue, retry policy
        +-- platform: secure storage, camera/files/location, notifications
        |
HTTPS API / Supabase Edge Functions
        +-- Auth and role/org authorization
        +-- Claims and workflow transactions
        +-- Document service and signed URLs
        +-- GIS/search/weather adapters
        +-- Notifications/outbox
        +-- Audit/event log
        |
Postgres + PostGIS + object storage + monitoring
```

The web and Android clients should share schemas and service clients. Do not copy the current demo objects into a second native codebase.

## 4. Delivery plan

### Phase 0 — Stop the bleeding

- Rotate/remove committed or exposed keys.
- Disable public self-assignment of privileged roles.
- Remove or label demo values and simulated service status.
- Confirm the actual source of truth: local workspace vs GitHub `main`.
- Add a release branch and CI build gate.

### Phase 1 — Make the web product real

- Create Supabase migrations, RLS policies, storage policies and seed data.
- Implement claims CRUD and the workflow state machine.
- Wire upload/storage/scanning and signed downloads.
- Wire GIS layers and make public data redaction explicit.
- Add real error, offline and empty states.
- Add test fixtures for each role and workflow transition.

### Phase 2 — Mobile packaging

- Add Capacitor Android project with stable application ID, app icon, splash, deep links and release signing.
- Add secure token storage and test auth redirects inside the app.
- Add file/camera/location permission flows only when needed and with disclosure.
- Add offline queue for field capture, conflict handling and retry visibility.
- Validate Android 16/API 36 targeting for new Play submissions as of August 31, 2026; see the [official target API requirement](https://developer.android.com/google/play/requirements/target-sdk).
- Verify 16 KB page-size support for native dependencies when targeting Android 15+; see [Android 16 KB page-size guidance](https://developer.android.com/guide/practices/page-sizes).

### Phase 3 — Play Console release

- Create a Play Console app with verified developer identity and a unique package name.
- Produce a signed Android App Bundle (`.aab`) through CI; keep upload keys in a secret manager and enable Play App Signing.
- Complete store listing, screenshots, content rating, target audience, privacy policy, Data Safety, app access instructions and sensitive-permission declarations.
- Run internal testing, then closed testing with real role-based scenarios.
- If this is a new personal developer account created after 2023-11-13, plan for Google’s current requirement of at least 12 testers continuously opted in for 14 days before production access; see [official testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).
- Use pre-launch reports, crash/ANR monitoring and staged rollout. Do not publish until the launch gates below are green.

## 5. Launch acceptance gates

### Functional

- New user can register only for an allowed onboarding role.
- Admin approval changes permissions server-side and is audited.
- Each claim upload persists metadata and documents, survives refresh, and can be recovered after a network retry.
- Invalid workflow transitions are rejected by the server.
- Committee decision records actor, quorum, reason and timestamp.
- Public map shows only approved/redacted data from the published dataset.
- Offline field capture visibly queues and later reconciles changes.

### Reliability

- Clean install, login, logout, password reset and OAuth redirect tested on physical Android devices.
- No route loads indefinitely when Supabase is unavailable.
- No demo data appears in production configuration.
- Maps, storage, notifications and content APIs have health checks and incident ownership.
- Crash-free sessions, ANR, API latency and failed upload metrics have alert thresholds.

### Security/compliance

- No secrets in source, browser bundle or APK.
- RLS/policy tests cover every table and storage bucket.
- Privacy policy and deletion/export process are live.
- Play Data Safety matches actual collection/sharing, including SDKs.
- Sensitive permission disclosures precede permission requests.
- Security review covers IDOR, role escalation, signed URL leakage, XSS, upload malware and location privacy.

### Release

- Version code/name, application ID, icons, splash, signing and reproducible build are configured.
- Target API level is current for the submission date.
- AAB installs and updates over the previous build.
- Closed-test feedback is triaged and critical defects are fixed.
- Rollout, rollback and support contacts are documented.

## 6. Prioritized backlog

| Rank | Work item | Exit evidence |
|---:|---|---|
| 1 | Rotate/remove committed environment values | Secret scan clean; Supabase keys rotated |
| 2 | Add auth/RBAC/RLS model and remove client role elevation | Policy tests and negative authorization tests |
| 3 | Add DB migrations and claim workflow API | End-to-end claim lifecycle persists |
| 4 | Make demo/live/offline state explicit | No silent fallback; UI state tests |
| 5 | Implement storage/scanning/signed URLs | Upload/download/expiry/security tests |
| 6 | Replace simulated GIS and weather status | Real provider health and source timestamp |
| 7 | Add CI, lint, tests, dependency/secret scanning | Protected branch green build |
| 8 | Add Capacitor Android shell and signing | Signed AAB installs on physical devices |
| 9 | Complete privacy/Play Console artifacts | Policy review checklist complete |
| 10 | Closed test and staged rollout | Testing requirement met if applicable; no P0/P1 defects |

## 7. Audit limitation

This audit is source-based. The repository snapshot exposes the front end and configuration, but not Supabase migrations, policies, backend functions, CI history, production dashboards or a signed mobile build. Those must be supplied and tested before any claim of service activation or Play Store readiness.

