# FRA Atlas / Adi-bandhu — AWS Implementation Guide

**Version:** 1.0  
**Date:** 2026-10-11  
**Scope:** implementation of the application from authentication through database, file storage, GIS, notifications, observability and deployment  
**Depends on:** [DATABASE_DESIGN.md](DATABASE_DESIGN.md)

## 1. Target outcome

This guide converts the current React/Vite/PWA prototype and the database blueprint into a production AWS system. It assumes:

- React remains the web client and is later packaged for Android with Capacitor or a Trusted Web Activity;
- AWS Cognito replaces the current Supabase Auth dependency;
- Amazon Aurora PostgreSQL is the system of record;
- PostGIS stores claim boundaries and geospatial features;
- Amazon S3 stores private claim documents and public map assets;
- API Gateway and Lambda provide the application API;
- CloudFront serves the web application;
- Amazon Location Service provides maps/search/geocoding where appropriate;
- asynchronous work uses SQS/EventBridge and notifications use SES/SNS or an approved mobile push provider.

The browser/mobile clients must never connect directly to Aurora or S3 private objects. All sensitive access goes through authenticated APIs and short-lived signed URLs.

## 2. Recommended AWS architecture

```text
Users / Android / browser
          |
          +-- Route 53 + ACM TLS
          |
          +-- CloudFront + WAF
          |       |
          |       +-- private S3 web bucket (React/Vite build)
          |
          +-- API Gateway HTTP API
                  |
                  +-- Cognito JWT authorizer
                  |
                  +-- Lambda application services in private subnets
                          |
                          +-- RDS Proxy
                          |       |
                          |       +-- Aurora PostgreSQL + PostGIS
                          |
                          +-- S3 private documents
                          +-- Amazon Location Service
                          +-- SQS/EventBridge workers
                          +-- SES/SNS notifications
                          +-- CloudWatch/X-Ray/CloudTrail
```

### Service map

| Concern | AWS service | Responsibility |
|---|---|---|
| DNS/TLS | Route 53, ACM | Domain routing and certificates |
| Web hosting | S3, CloudFront | Static React/PWA delivery with SPA fallback |
| Edge security | AWS WAF, Shield Standard | Rate limits and common web protections |
| Identity | Cognito User Pool | Sign-up, sign-in, recovery, MFA, OAuth |
| API | API Gateway HTTP API | HTTPS routes, throttling, JWT validation |
| Application logic | Lambda | authorization, validation and transactions |
| Database | Aurora PostgreSQL | claims, workflow, organizations and reports |
| Spatial data | PostGIS, Amazon Location | boundaries, map search and geocoding |
| Documents | S3 private bucket | encrypted uploads, scans and signed downloads |
| Async work | SQS, EventBridge, Step Functions where needed | retries, outbox, scanning and notifications |
| Secrets | Secrets Manager, KMS | database credentials and provider secrets |
| Monitoring | CloudWatch, X-Ray, CloudTrail | logs, metrics, traces and audit of AWS actions |
| Delivery | CodeBuild/CodePipeline or GitHub Actions OIDC | build, migrate and deploy without long-lived keys |

## 3. AWS account and environment model

Use separate AWS accounts when possible:

```text
AWS Organization
  +-- security account
  +-- log archive account
  +-- development account
  +-- staging account
  +-- production account
```

If separate accounts are not yet possible, use separate stacks, VPCs, databases, buckets, Cognito pools and AWS Secrets Manager secrets per environment. Never let development Lambda roles read production documents or databases.

Recommended initial region: choose one region close to primary users and approved by the data-governance owner. Keep CloudFront global; keep the database, Lambda and S3 data in the approved regional boundary.

Naming convention:

```text
fra-{environment}-{service}-{region}

Examples:
fra-prod-api-ap-south-1
fra-prod-db-ap-south-1
fra-prod-claim-documents-ap-south-1
fra-prod-web-ap-south-1
```

## 4. Authentication implementation with Cognito

### 4.1 User Pool

Create one Cognito User Pool per environment with:

- email sign-in and verified email;
- password policy defined by security review;
- MFA enabled or optional based on role risk;
- account recovery through verified email/phone;
- advanced threat protection if required by risk profile;
- retention and deletion process aligned with the privacy policy;
- pre-sign-up validation for allowed onboarding roles;
- post-confirmation trigger to create `profiles` and an applicant/pending membership.

Create an app client without a client secret for the browser/Android public client. Store the client ID, pool ID and issuer URL as non-secret configuration. Never put Cognito client secrets, AWS access keys or database credentials in `VITE_*` variables.

### 4.2 OAuth

Add Google or another approved identity provider only after configuring:

- callback URLs for local, staging and production;
- logout URLs;
- approved scopes;
- verified domains;
- account-linking policy;
- duplicate-email handling.

Do not allow OAuth claims to select `administrator`, `committee_member` or other privileged roles.

### 4.3 Role model

Cognito groups may help with coarse application scopes, but the authoritative role and organization membership remains in Aurora:

```text
Cognito subject (sub)
        -> profiles.id
        -> organization_memberships
        -> roles / permissions
```

The backend loads effective permissions from the database on every protected operation or from a short-lived, versioned permission cache. A URL query such as `?r=Administrator` may change display state only; it never changes authorization.

### 4.4 Authentication flow

```text
1. Client starts Cognito Hosted UI or SDK sign-in.
2. Cognito returns access/ID tokens to the client.
3. Client sends access token as Authorization: Bearer <token>.
4. API Gateway JWT authorizer validates issuer, audience, expiry and scopes.
5. Lambda reads the Cognito subject from the verified request context.
6. Lambda loads profile/membership/permissions from Aurora.
7. Lambda executes an authorized transaction and writes an audit event.
```

API Gateway HTTP APIs support JWT authorizers that validate tokens and pass claims to Lambda. Use scopes for coarse route access and database authorization for organization/claim-level access. See the [AWS API Gateway JWT authorizer documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html).

## 5. Networking and security baseline

### VPC

Create a VPC with:

- two or more private subnets for Aurora and Lambda;
- public subnets only for managed ingress components when required;
- NAT gateways only where private workloads need outbound internet;
- VPC endpoints for S3, Secrets Manager, CloudWatch Logs and STS where supported;
- database security group allowing PostgreSQL only from RDS Proxy;
- Lambda security group allowing egress to RDS Proxy, S3 endpoints and approved providers.

Aurora must not be publicly accessible. Use RDS Proxy for Lambda connection pooling. AWS documents Lambda connections through RDS Proxy for PostgreSQL and other RDS engines; see [Using AWS Lambda with Amazon RDS](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html).

### IAM

Create separate roles for:

- API Lambda read/write database;
- document upload signer;
- document scan worker;
- notification worker;
- migration runner;
- deployment pipeline;
- read-only operations dashboards.

Use resource-specific ARNs, conditions on environment tags and short-lived OIDC federation for CI. Do not use administrator credentials in CI or application Lambda.

### Encryption

- Aurora storage encryption with a customer-managed KMS key where required;
- S3 SSE-KMS for claim documents;
- CloudWatch log-group encryption and retention;
- Secrets Manager encryption;
- TLS for CloudFront, API Gateway, Aurora and all external providers;
- do not log tokens, identity documents, raw sensitive numbers or full request bodies.

### Edge protection

Attach WAF to CloudFront and, where needed, API Gateway. Add managed common-rule protections, IP/rate limits for sign-up, login, document-upload initialization, search and public endpoints. Use API Gateway throttling and request validation as a second layer.

## 6. Web/PWA hosting

### S3 + CloudFront

1. Build the Vite app with a deterministic Node version.
2. Upload `dist/` to a private S3 bucket.
3. Put CloudFront in front of the bucket using Origin Access Control.
4. Block all public S3 access.
5. Configure SPA fallback for `index.html` on 403/404.
6. Set immutable cache headers for hashed assets and short cache for `index.html`.
7. Attach ACM certificate and Route 53 alias.
8. Add security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` and frame restrictions.

CloudFront Origin Access Control allows CloudFront to read a private S3 origin while keeping the bucket private. See [Restrict access to an S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

Correct the current deployment mismatch: Vite normally writes `dist`, while the existing deployment files reference `build`. Set `build.outDir` explicitly or publish `dist` consistently.

### Browser configuration

Only expose values that are safe for a public client:

```text
VITE_API_BASE_URL=https://api.example.gov.in
VITE_COGNITO_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=...
VITE_COGNITO_CLIENT_ID=...
VITE_COGNITO_ISSUER=https://cognito-idp....amazoncognito.com/...
VITE_WEB_ORIGIN=https://app.example.gov.in
```

Database passwords, AWS access keys, SES credentials, private signing keys and third-party secret keys belong in Secrets Manager or IAM—not in the frontend bundle.

## 7. API implementation

Use a versioned HTTP API under `/v1`.

### Route groups

| Route | Purpose | Auth |
|---|---|---|
| `GET /v1/me` | Profile and effective permissions | Cognito |
| `POST /v1/onboarding` | Complete profile/pending membership | Cognito |
| `GET /v1/dashboard` | Role-scoped statistics | Cognito |
| `POST /v1/claims` | Create draft | Cognito |
| `POST /v1/claims/{id}/submit` | Submit claim | Cognito |
| `GET /v1/claims` | Filtered claim queue | Cognito |
| `GET /v1/claims/{id}` | Claim details by permission | Cognito |
| `POST /v1/claims/{id}/assign` | Assign field officer | Cognito |
| `POST /v1/claims/{id}/verification` | Save/complete verification | Cognito |
| `POST /v1/reviews/{id}/votes` | Cast committee vote | Cognito |
| `POST /v1/reviews/{id}/decision` | Finalize decision | Cognito + chair |
| `POST /v1/documents/upload-url` | Get upload URL | Cognito |
| `GET /v1/documents/{id}/download-url` | Get short-lived signed URL | Cognito |
| `GET /v1/map/public` | Redacted published layers | Public or Cognito |
| `GET /v1/places/search` | Server-proxied geocoding/search | Public with rate limit |
| `GET /v1/notifications` | User notifications | Cognito |
| `POST /v1/grievances` | Submit grievance | Cognito/public policy |
| `GET /v1/health` | Liveness/readiness summary | Restricted |

### Lambda project layout

```text
backend/
  src/
    handlers/
      me.ts
      dashboard.ts
      claims.ts
      verification.ts
      committee.ts
      documents.ts
      maps.ts
      notifications.ts
    domain/
      authorization.ts
      claim-workflow.ts
      dss.ts
    data/
      db.ts
      repositories/
    events/
      outbox.ts
    validation/
    observability/
  migrations/
  package.json
```

Use a shared request context containing `requestId`, Cognito subject, profile ID, organization memberships and permissions. Validate input with a schema library and return stable error codes rather than raw database messages.

### API response contract

```json
{
  "data": {},
  "requestId": "uuid",
  "source": "live",
  "updatedAt": "2026-10-11T00:00:00Z"
}
```

Errors:

```json
{
  "error": {
    "code": "CLAIM_INVALID_TRANSITION",
    "message": "The claim cannot be submitted from its current state.",
    "details": {}
  },
  "requestId": "uuid"
}
```

The frontend must never replace an API error with hard-coded success data.

## 8. Aurora PostgreSQL implementation

### Database setup

1. Create Aurora PostgreSQL in private subnets.
2. Enable storage encryption, backups, deletion protection in production and Performance Insights where approved.
3. Enable PostGIS and required extensions in a migration.
4. Create separate database roles: migration, application read/write, reporting read-only and support read-only.
5. Store credentials in Secrets Manager; rotate them on a schedule. See [RDS password management with Secrets Manager](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html).
6. Put RDS Proxy in front of the writer endpoint for Lambda.
7. Apply `docs/DATABASE_DESIGN.md` as ordered migrations.

Aurora PostgreSQL supports PostGIS extensions; verify the chosen engine version against the [supported Aurora PostgreSQL extensions list](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/AuroraPostgreSQL.Extensions.html).

### Authorization inside the database

The API performs authorization before queries. Add database defense-in-depth by setting transaction-local context:

```sql
begin;
select set_config('app.user_id', :profile_id, true);
select set_config('app.organization_ids', :organization_ids_json, true);
select set_config('app.request_id', :request_id, true);
-- RLS-protected queries and writes
commit;
```

Use transaction-local settings only; never leave one user’s context on a pooled connection. Test this carefully with RDS Proxy.

### Migration discipline

```text
backend/migrations/
  0001_extensions.sql
  0002_identity.sql
  0003_claims.sql
  0004_documents.sql
  0005_verification.sql
  0006_committee.sql
  0007_dss.sql
  0008_gis.sql
  0009_notifications.sql
  0010_audit.sql
  0011_indexes_views.sql
```

Each migration must be forward-only, reviewed, tested against a disposable database and recorded in a schema-migrations table. Never edit an already-applied migration in staging or production.

## 9. Documents and uploads

### Secure upload flow

```text
1. Client sends document metadata to POST /v1/documents/upload-url.
2. Lambda checks claim access, file type, size and allowed document type.
3. Lambda creates a database row with scan_status = pending.
4. Lambda returns a short-lived S3 pre-signed PUT URL.
5. Client uploads directly to the private quarantine prefix.
6. S3 event sends a message to SQS.
7. Scan worker validates type, size, hash and malware status.
8. Clean file moves to the private claim prefix; row becomes clean.
9. Authorized download creates a short-lived signed GET URL.
10. Every access and state change writes an audit event.
```

Use S3 versioning, lifecycle policies, object ownership, block public access and SSE-KMS. Do not trust filename extensions or browser MIME types.

## 10. GIS and location services

Use PostGIS for authoritative claim geometry and spatial queries. Use Amazon Location Service for map rendering, place search and geocoding where its coverage, pricing and data-governance review are acceptable. Amazon Location provides maps, places, routes, geofences and trackers; see the [Amazon Location developer guide](https://docs.aws.amazon.com/location/latest/developerguide/).

Recommended flow:

1. Client requests a map style/session through the API.
2. API checks user/public policy and returns safe map configuration.
3. Public claims come from `published_claims_map` with redaction.
4. Private officer views query authorized claim features through the API.
5. Search/geocoding is server-proxied and rate-limited; do not log sensitive free-text location queries.
6. Boundary edits are versioned and validated with PostGIS.

Do not use a Google Maps iframe as the authoritative claims map. It can remain as a temporary prototype fallback only.

## 11. Async processing and notifications

Use the transactional outbox pattern:

```text
claim transaction
   +-- claim/status/audit rows
   +-- outbox event
          |
          +-- EventBridge or SQS
                  +-- notification worker
                  +-- document scan worker
                  +-- analytics/report worker
```

Use SQS dead-letter queues, visibility timeouts, retry limits and idempotency keys. Email can use SES; SMS or mobile push can use an approved provider/SNS integration after privacy and cost review.

## 12. Observability and operations

### Logs and metrics

Every API request logs:

- `requestId`, route, status, latency and actor subject hash;
- organization and claim IDs only when policy permits;
- error code and downstream dependency;
- no credentials, document contents or raw sensitive identifiers.

CloudWatch alarms should cover:

- API 5xx and 4xx spikes;
- Lambda errors, throttles and duration;
- Aurora CPU, connections, storage, replica lag and deadlocks;
- RDS Proxy connection saturation;
- S3 upload/scan failures;
- SQS age of oldest message and DLQ depth;
- Cognito failed sign-ins and account takeover signals;
- CloudFront 4xx/5xx and origin errors.

### Audit

Application audit events go to Aurora `audit_events`; AWS control-plane activity goes to CloudTrail. Restrict audit reads and retain according to legal policy. Export long-term audit/CloudTrail data to an encrypted log archive account where required.

### Backup and recovery

- Aurora automated backups and point-in-time recovery;
- scheduled snapshots with retention policy;
- S3 versioning and lifecycle rules;
- cross-region backup strategy for production;
- quarterly restore drills;
- documented RPO/RTO and named incident owner.

## 13. Infrastructure as code

Use one IaC system. AWS CDK in TypeScript is a practical choice for this JavaScript/TypeScript product.

```text
infra/
  bin/app.ts
  lib/network-stack.ts
  lib/identity-stack.ts
  lib/database-stack.ts
  lib/storage-stack.ts
  lib/api-stack.ts
  lib/web-stack.ts
  lib/observability-stack.ts
  lib/environment.ts
```

Stacks should provision, at minimum:

- VPC, subnets, security groups and endpoints;
- Cognito user pool/client/domain;
- Aurora, RDS Proxy and Secrets Manager secret;
- S3 buckets and KMS keys;
- API Gateway, JWT authorizer, Lambda functions and permissions;
- SQS queues/DLQs and EventBridge rules;
- CloudFront, OAC, WAF, ACM and Route 53 records;
- CloudWatch log groups, dashboards and alarms.

Do not create production resources manually and then attempt to reverse-engineer them into IaC.

## 14. CI/CD pipeline

Use GitHub Actions with AWS IAM OIDC federation or CodePipeline. Never store long-lived AWS access keys in GitHub secrets.

```text
Pull request
  -> install with lockfile
  -> type/lint/test
  -> secret scan + dependency audit
  -> build frontend/backend
  -> deploy ephemeral or staging stack
  -> migration dry run + integration tests

Main branch
  -> build immutable artifacts
  -> deploy dev automatically
  -> promote staging with approval
  -> run migrations through private migration runner
  -> deploy Lambda/API/web
  -> smoke tests
  -> production approval + staged rollout
```

Migration order in production:

1. Apply backward-compatible schema migration.
2. Deploy backend that supports old and new schema.
3. Backfill data if required.
4. Deploy frontend/mobile client.
5. Remove old schema only in a later release.

## 15. Client integration changes

Replace current Supabase client usage with:

- Cognito SDK/Hosted UI for login/signup/recovery;
- an API client that attaches the Cognito access token;
- typed response/error models;
- upload service that requests signed URLs;
- offline queue for drafts and field capture;
- explicit `live`, `stale`, `offline`, `loading`, `empty` and `error` states;
- React Router navigation instead of `window.location.href` for internal routes.

The existing page-level demo data should move into test fixtures. It must not be the production fallback.

## 16. Implementation phases

### Phase 1 — Foundation

- Create AWS accounts/environments, VPC, KMS, IAM and IaC repository.
- Create Cognito pool, CloudFront/S3 site and API skeleton.
- Add CI with OIDC, secret scanning and staging deployment.

### Phase 2 — Identity and data

- Apply database migrations from `DATABASE_DESIGN.md`.
- Implement profile bootstrap and membership approval.
- Implement API authorization helpers, RLS/defense-in-depth and audit events.

### Phase 3 — Claims and documents

- Implement claim draft/submit/assignment workflow.
- Implement private S3 upload, scan, signed download and retention.
- Implement field visits and verification checklists.

### Phase 4 — Committee, DSS and GIS

- Implement meetings, quorum, votes and final decisions.
- Move DSS rules to versioned database tables.
- Implement PostGIS queries and redacted public map publication.

### Phase 5 — Notifications and operations

- Add outbox, SQS workers, email/push delivery and retry dashboards.
- Add CloudWatch alarms, CloudTrail, backups, restore drills and runbooks.

### Phase 6 — Mobile distribution

- Add Capacitor Android shell or approved TWA.
- Test Cognito redirects, signed uploads, offline retry, device permissions and deep links.
- Produce signed AAB, closed test and staged rollout after all P0/P1 gates are green.

## 17. Production acceptance checklist

### Authentication

- Cognito sign-up, verification, recovery, logout and MFA tested.
- Privileged roles require administrator approval.
- API Gateway rejects invalid/expired/wrong-audience tokens.
- Database authorization prevents cross-organization access.

### Database and claims

- Migrations are reproducible and backed up.
- Claims survive refresh and retries.
- Invalid transitions and duplicate writes fail safely.
- Votes, decisions and role changes are immutable/audited.

### Documents and GIS

- S3 buckets are private and encrypted.
- Uploads are scanned and signed URLs expire.
- Public map exposes only approved/redacted data.
- Geometry validation and spatial indexes are tested.

### Operations

- Alarms, dashboards, logs and runbooks exist.
- Restore drill has been completed.
- No secrets are in source, frontend bundles or mobile APK/AAB.
- Staging and production are isolated.

## 18. Official AWS references

- [Amazon Cognito authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication.html)
- [API Gateway HTTP API JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Lambda with Amazon RDS/RDS Proxy](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html)
- [Aurora PostgreSQL supported extensions](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/AuroraPostgreSQL.Extensions.html)
- [CloudFront Origin Access Control for S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Amazon Location Service](https://docs.aws.amazon.com/location/latest/developerguide/)
- [Secrets Manager rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)

