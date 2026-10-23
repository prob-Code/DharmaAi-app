# FRA Atlas / Adi-bandhu — Application Documentation

**Document status:** Baseline documentation for the repository snapshot reviewed on 2026-10-11  
**Repository reviewed:** `prob-Code/Adi-bandhu` (`main`)  
**Product type:** React 18 + Vite responsive web application/PWA; not yet a native Android application

## 1. Product purpose

The application is positioned as a Forest Rights Act (FRA) / Tribal Affairs management platform. It combines public discovery of approved claims and forest-rights information, authenticated role-based dashboards, claim upload and metadata capture, claim verification and committee review, decision-support recommendations for government schemes, GIS/map-oriented screens, and Supabase authentication.

The current implementation is a front-end demonstrator with partial Supabase integration. It should not be described as a production government system until the data model, authorization model, audit trail, storage, maps, and operational controls are implemented and independently verified.

## 2. Current architecture

```text
Browser / PWA shell
        |
        +-- React entry point (src/index.jsx)
        |     +-- UiProvider
        |     +-- AuthProvider
        |     +-- App -> Routes
        |
        +-- React Router routes (src/Routes.jsx)
        |     +-- public map viewer
        |     +-- auth screens
        |     +-- protected dashboard/workflows
        |
        +-- Supabase JS client (src/utils/supabaseClient.js)
        |     +-- Auth session persistence
        |     +-- attempted table counts
        |
        +-- Local/demo data
              +-- src/utils/dataProviders.js
              +-- src/services/dashboardData.js
              +-- page-local mock claims, map features, notifications, weather
```

### Main directories

| Area | Location | Responsibility |
|---|---|---|
| Application bootstrap | `src/index.jsx`, `src/App.jsx` | Mount providers, render routes and government footer |
| Routing | `src/Routes.jsx` | Public/protected route definitions and lazy page loading |
| Authentication | `src/context/AuthContext.jsx`, `src/pages/auth/*` | Supabase session, login, signup and OAuth entry points |
| Route guards | `src/components/ProtectedRoute.jsx`, `PublicRoute.jsx` | Client-side session gating |
| Shared UI | `src/components/*` | Icons, buttons, error boundary, SEO, loading and government footer |
| Workflows | `src/pages/claim-upload-interface`, `claim-verification`, `committee-review` | Claim processing UI |
| Dashboards | `src/pages/multi-role-dashboard` | Role-oriented dashboard and panels |
| GIS | `src/pages/interactive-web-gis-map`, `public-map-viewer` | Map-like screens, search, layers, feature panels |
| Domain logic | `src/utils/dss.js`, `roleRouting.js` | Scheme scoring and role-to-dashboard routing |
| Data access | `src/services/dashboardData.js`, `src/utils/dataProviders.js` | Supabase counts, API fallback and demo data |
| Static delivery | `vite.config.mjs`, `vercel.json`, `netlify.toml`, `public/*` | Build/deployment/PWA assets |

## 3. User journeys

### Public visitor

Open `/public-map-viewer`, dismiss the first-visit overlay, view the map iframe and simulated feature overlays, then use layer, search, language, accessibility and feature panels.

The current public map is primarily a UI prototype: it embeds Google Maps and overlays hard-coded demo features. It does not yet load authoritative claim or boundary data.

### Authenticated user

1. Open `/auth/login` or `/auth/signup`.
2. Authenticate with Supabase email/password or Google OAuth.
3. Read the role from `user_metadata.role`.
4. Route to a role-specific dashboard path.
5. Use dashboard quick actions to enter claims, verification, review, map or DSS screens.

### Roles

- **Field Officer:** active claims, pending verification, completed-today and field-visit indicators; claim upload and field context.
- **Committee Member:** pending, approved and rejected claims; evidence, legal framework, DSS, discussion and decision panels.
- **Administrator:** system/user/claim statistics, role selector, audit-log, grievance, compliance and notification panels.
- **Public Viewer:** public map and public information.

The repository does not currently show a server-side decision transaction, immutable vote record, or verified authorization boundary for these actions.

## 4. Environment and local development

### Required configuration

The front end reads these Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- optional `VITE_API_BASE` for `/news`, `/schemes`, `/links` and `/gallery`

The checked repository also contains placeholder variables for several AI, analytics, advertising and payment services. They are not evidence that those services are implemented. Do not put secret server keys in a `VITE_*` variable; Vite exposes those values to the browser bundle.

### Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

Before release, add and require `npm ci`, `npm run build`, `npm run lint` and `npm run test -- --runInBand` in CI. The current `package.json` does not define `lint` or `test`, so those commands must be added before claiming CI coverage.

## 5. Data and service contract

### Supabase tables assumed by the code

`src/services/dashboardData.js` attempts to query `claims`, `field_visits`, `committee_meetings`, `users` and `communities`. This repository contains no migrations, schema definitions, RLS policies, storage bucket definitions, edge functions, or seed data. Treat these tables and their columns/status values as an undocumented external dependency until a versioned database package is added.

### API endpoints assumed by the UI

`src/utils/dataProviders.js` optionally calls:

- `GET {VITE_API_BASE}/news`
- `GET {VITE_API_BASE}/schemes`
- `GET {VITE_API_BASE}/links`
- `GET {VITE_API_BASE}/gallery`

If the base URL is missing, unreachable, or returns a non-2xx response, the UI silently returns hard-coded fallback data. Production code should surface a service state and telemetry instead of silently converting an outage into fake success.

### GIS dependencies

MapLibre packages are installed, but the public map viewer currently embeds Google Maps and uses simulated overlay geometry. A production GIS service needs an explicit provider, API key policy, tile/style hosting, geocoding limits, caching, coordinate privacy rules and an authoritative data publication pipeline.

## 6. Deployment model today

The code is deployable as a Vite static site with SPA rewrites. Both Vercel and Netlify configuration are present, but their output directory is configured as `build`; Vite defaults to `dist` unless `vite.config.mjs` changes it. Verify this before deployment.

The app registers `/sw.js` and has a minimal `manifest.json`, so it can behave as an installable web app when served over HTTPS. That is not the same as an Android App Bundle and does not, by itself, create a Play Store app.

## 7. Production operating model to implement

1. **Identity and access:** Supabase Auth or an approved identity provider; server-side role and organization authorization.
2. **Claims API:** validation, workflow transitions, optimistic concurrency, idempotency and audit events.
3. **Document service:** private object storage, malware scanning, content-type/size limits, signed URLs and retention policy.
4. **GIS service:** authoritative layers, tile/vector endpoints, geospatial filtering and redaction for public views.
5. **Decision support:** versioned rules/model, explanations, human override and reproducible inputs.
6. **Notifications:** durable outbox, retries, delivery status and user preferences.
7. **Observability:** structured logs, error tracking, uptime checks, audit logs and privacy-safe analytics.

No user-facing workflow should report “success” until the corresponding durable server operation has succeeded.

## 8. Definition of done for a production feature

Every feature is ready only when it has an API/schema contract, loading/empty/offline/unauthorized/error states, authenticated server-side authorization, automated tests, an audit event for consequential actions, telemetry and an operational owner, a rollback/recovery path, verified mobile layouts/accessibility, and no demo fallback presented as authoritative data.

