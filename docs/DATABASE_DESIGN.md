# FRA Atlas / Adi-bandhu — Whole-Application Database Design

**Version:** 1.0  
**Date:** 2026-10-11  
**Recommended platform:** Supabase PostgreSQL + PostGIS + Auth + private Storage

## 1. Purpose and principles

This schema supports the entire application: identity, role-based access, individual/community FRA claims, document upload, field verification, committee review, voting, decisions, GIS maps, public publication, scheme recommendations, notifications, grievances, content, audit history and service health.

Core rules:

- The client never grants itself a role or permission.
- Every consequential write goes through an authenticated server-side function/API.
- RLS is enabled on every sensitive table.
- Final decisions and audit events are append-only.
- Public map data is read from a redacted publication view, never directly from private claims.
- Mobile retries use idempotency keys.
- All timestamps are UTC `timestamptz`; primary keys are UUIDs.

## 2. Logical architecture

```text
Supabase Auth (auth.users)
        |
        +-- profiles
        +-- organizations -> memberships -> roles -> permissions
        |
        +-- claims
        |     +-- parties, documents, boundaries
        |     +-- field visits, verification checklists
        |     +-- committee reviews, votes, decisions
        |     +-- status history, DSS recommendations
        |
        +-- GIS layers/features/publications
        +-- schemes/rules
        +-- notifications/deliveries/devices
        +-- grievances/content
        +-- audit events/service health/data requests
```

## 3. Identity and authorization

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK to `auth.users.id` with cascade |
| `full_name` | text | required after onboarding |
| `email` | citext | unique, synchronized from Auth |
| `phone` | text | optional, verified separately |
| `preferred_language` | text | default `en` |
| `status` | text | `pending`, `active`, `suspended`, `deleted` |
| `avatar_path` | text | private storage path |
| `last_seen_at` | timestamptz | optional operational signal |
| `created_at`, `updated_at` | timestamptz | required |

### `organizations`

Stores Ministry/state/district/block/Gram Sabha/committee/NGO boundaries.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `parent_id` | uuid FK to organizations |
| `organization_type` | text |
| `name`, `code` | text |
| `jurisdiction` | geography(MultiPolygon,4326) nullable |
| `status` | text: `active`, `inactive` |
| timestamps | — |

### `roles`, `permissions`, `role_permissions`

Seed roles: `platform_admin`, `organization_admin`, `field_officer`, `committee_member`, `review_chair`, `content_manager`, `applicant`, `public_viewer`.

Seed permission examples: `claim.read_assigned`, `claim.submit`, `claim.assign`, `claim.verify`, `committee.vote`, `claim.decide`, `document.read_sensitive`, `gis.publish`, `user.manage`.

### `organization_memberships`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id`, `profile_id`, `role_id` | uuid FK | membership and role |
| `scope_geometry` | geography nullable | optional sub-jurisdiction |
| `status` | text | `pending`, `active`, `suspended`, `revoked` |
| `starts_at`, `ends_at` | timestamptz | validity window |
| `approved_by` | uuid FK | required for privileged roles |
| timestamps | — | |

Do not use user-editable `user_metadata.role` for authorization. Role elevation requires an approved membership and RLS-visible permission.

## 4. Claims model

### `claims`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reference_code` | text unique | generated server-side |
| `organization_id` | uuid FK | owning office |
| `submitted_by`, `assigned_officer_id` | uuid FK | submitter and assignee |
| `claim_type` | text | `individual_forest_right`, `community_forest_right` |
| `status` | text | workflow state below |
| `priority` | text | `low`, `medium`, `high`, `critical` |
| `applicant_name`, `guardian_name` | text | confidential |
| `mobile_number`, `email` | text/citext | highly confidential/confidential |
| `village`, `block`, `district`, `state` | text | normalized reference tables preferred |
| `land_type`, `survey_number` | text | controlled/internal |
| `total_area_ha` | numeric(12,4) | `>= 0` |
| `family_count` | integer | `>= 0` |
| `traditional_use` | text | confidential |
| `declarations` | jsonb | versioned declaration answers |
| `submitted_at`, `decided_at`, `published_at` | timestamptz | server controlled |
| `created_at`, `updated_at` | timestamptz | required |

### Claim workflow

```text
draft -> submitted -> assigned -> in_verification
      -> verification_completed -> committee_pending
      -> approved -> published
      -> rejected

submitted -> returned_for_correction -> submitted
any eligible state -> withdrawn
```

Only a server-side transaction may move a claim between states. It checks current state, permission, organization scope, required evidence, duplicate rules and required reasons.

### `claim_parties`

Supports multiple applicants, guardians, community representatives and Gram Sabha bodies.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `claim_id` | uuid FK |
| `party_type` | text |
| `profile_id` | uuid nullable |
| `display_name` | text |
| `identifier_hash` | text nullable |
| `contact_json` | jsonb nullable |
| `is_primary` | boolean |
| timestamps | — |

Never store raw government identifiers unless legally required; prefer a salted hash plus a secure external verification reference.

### `claim_boundaries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `claim_id` | uuid FK | |
| `geometry` | geometry(MultiPolygon,4326) | validate with `ST_IsValid` |
| `centroid` | geography(Point,4326) | generated/maintained |
| `source` | text | `field_capture`, `uploaded_gis`, `official_record`, `manual` |
| `accuracy_m` | numeric | optional GPS accuracy |
| `version` | integer | optimistic concurrency |
| `is_current` | boolean | one current boundary per claim |
| `captured_by` | uuid FK | |
| timestamps | — | |

```sql
create index claim_boundaries_gist_idx
  on public.claim_boundaries using gist (geometry);

create unique index one_current_boundary_per_claim
  on public.claim_boundaries (claim_id) where is_current;
```

### `claim_documents`

| Column | Type | Notes |
|---|---|---|
| `id`, `claim_id` | uuid | PK/FK |
| `storage_bucket`, `storage_path` | text | private bucket; generated path |
| `document_type` | text | controlled lookup |
| `original_filename` | text | sanitized display value |
| `mime_type`, `size_bytes`, `sha256` | text/bigint/text | verified server-side |
| `scan_status` | text | `pending`, `clean`, `quarantined`, `failed` |
| `verification_status` | text | `pending`, `accepted`, `rejected`, `needs_review` |
| `verified_by`, `verified_at` | uuid/timestamptz | nullable |
| `retention_until` | timestamptz | policy-driven |
| timestamps | — | |

Storage buckets:

- `claim-private-documents` — private, signed URLs only;
- `claim-quarantine` — inaccessible to normal users;
- `public-map-assets` — only approved/redacted assets;
- `avatars` — private or controlled public.

## 5. Field verification

### `field_visits`

`id`, `claim_id`, `officer_id`, `scheduled_at`, `started_at`, `completed_at`, `status`, `start_point`, `end_point`, `notes`, `device_session_id`, timestamps.

Status values: `scheduled`, `in_progress`, `completed`, `cancelled`.

Location collection must be minimized, disclosed and retained only as long as needed. Do not enable continuous background tracking for a field-visit workflow.

### `verification_checklists` and `verification_items`

`verification_checklists` stores `claim_id`, `template_version`, `assigned_to`, `status`, `started_at`, `completed_at`, `submitted_by` and timestamps.

`verification_items` stores `checklist_id`, `code`, `label_snapshot`, `result`, `notes`, `evidence_document_id`, `completed_by` and `completed_at`.

Versioning and `label_snapshot` preserve the meaning of historical verification after policy changes.

## 6. Committee review and decisions

### `committee_meetings`

`id`, `organization_id`, `scheduled_at`, `location`, `agenda_path`, `status`, `created_by`, timestamps.

### `committee_attendance`

`meeting_id`, `profile_id`, `attendance_status`, `checked_in_at`, `verified_by`.

### `committee_reviews`

`id`, `claim_id`, `organization_id`, `meeting_id`, `status`, `opened_by`, `quorum_required`, `quorum_reached_at`, timestamps.

Status values: `opened`, `in_review`, `voting`, `decided`, `closed`.

### `committee_votes`

`id`, `committee_review_id`, `voter_id`, `vote`, `reason`, `vote_hash`, `cast_at`.

Votes: `approve`, `reject`, `return`, `abstain`. Add a unique constraint on `(committee_review_id, voter_id)`. Reject/return requires a reason. A server function checks active membership, attendance and voting window.

### `decisions`

`id`, `claim_id`, `committee_review_id`, `decision`, `reason`, `conditions_json`, `decided_by`, `decided_at`, `policy_version`, `supersedes_decision_id`, timestamps.

Final decisions are append-only. Corrections create a superseding decision rather than editing history.

### `claim_status_history`

`id`, `claim_id`, `from_status`, `to_status`, `reason`, `actor_id`, `request_id`, `occurred_at`.

This is the authoritative workflow timeline.

## 7. Decision-support system

Move the current local rule catalog into versioned tables.

### `schemes`

`id`, `code`, `name`, `category`, `description`, `benefits_json`, `eligibility_text`, `status`, `effective_from`, `effective_until`, timestamps.

### `scheme_rules`

`id`, `scheme_id`, `version`, `rule_json`, `priority`, `effective_from`, `effective_until`, `created_by`, timestamps.

### `scheme_recommendations`

`id`, `claim_id`, `scheme_id`, `rule_version`, `score`, `reasons_json`, `input_snapshot_json`, `generated_by`, `generated_at`, `status`, `reviewed_by`, `reviewed_at`.

Save the input snapshot and rule version so recommendations are reproducible and explainable. DSS remains advisory and must not automatically approve claims.

## 8. GIS and public map publication

### `gis_layers`

`id`, `code`, `name`, `layer_type`, `classification`, `source_owner`, `style_json`, `attribution`, `status`, timestamps.

### `gis_features`

`id`, `layer_id`, `source_key`, `geometry`, `properties_json`, `classification`, `valid_from`, `valid_until`, `is_current`, timestamps.

Add a GiST index to `geometry`. Keep raw source features separate from redacted public features.

### `map_publications` and `map_publication_layers`

`map_publications`: `id`, `version`, `status` (`draft`, `review`, `published`, `retired`), `published_by`, `published_at`, `release_notes`, timestamps.

`map_publication_layers`: `publication_id`, `layer_id`, `data_snapshot_path`, `style_snapshot_path`, `redaction_policy_version`.

Expose a security-barrier view such as `public.published_claims_map` containing only approved/public claims, generalized geometry where required, non-sensitive reference codes, aggregate location labels and publication timestamp.

## 9. Notifications, grievances and content

### Notifications

`notifications`: `id`, `recipient_id`, `organization_id`, `type`, `title`, `body`, `data_json`, `read_at`, `created_at`, `expires_at`.

`notification_deliveries`: `id`, `notification_id`, `channel`, `provider_message_id`, `status`, `attempt_count`, `last_error`, `sent_at`, timestamps.

`device_registrations`: `id`, `profile_id`, `platform`, `push_token_hash`, `app_version`, `last_seen_at`, `revoked_at`.

Use an outbox/worker pattern with retries and idempotency. Protect push tokens as credentials.

### `grievances`

`id`, `claim_id` nullable, `submitted_by`, `organization_id`, `category`, `description`, `priority`, `status`, `assigned_to`, `resolution`, `resolved_at`, timestamps.

### `content_items`

Unifies news, schemes, links and gallery metadata: `id`, `content_type`, `title`, `summary`, `body_json`, `url`, `asset_path`, `language`, `status`, `published_at`, `expires_at`, `created_by`, timestamps.

## 10. Audit, health and privacy operations

### `audit_events`

Append-only fields: `id`, `occurred_at`, `actor_id`, `organization_id`, `action`, `entity_type`, `entity_id`, `request_id`, `ip_hash`, `user_agent_hash`, `before_json`, `after_json`, `reason`, `metadata_json`.

Do not put passwords, tokens, full identity numbers or document contents in audit JSON.

### `service_health_checks`

`id`, `service_name`, `check_type`, `status`, `latency_ms`, `checked_at`, `error_code`, `metadata_json`.

Track auth, database, storage, map provider, geocoder, content API, notifications and weather. Dashboard labels must read from real health data rather than hard-coded “Active” values.

### `data_access_requests`

`id`, `profile_id`, `request_type` (`export`, `delete`, `correct`), `status`, `requested_at`, `completed_at`, `completed_by`, `result_path`, `notes`.

## 11. RLS policy matrix

Enable RLS on every sensitive table. Policies must check membership status, organization/jurisdiction and ownership.

| Actor | Read | Create/update | Finalize/publish |
|---|---|---|---|
| Applicant | own claims/documents/status | own draft; correct returned claim | none |
| Field officer | assigned/jurisdiction claims | visits/checklists; assigned verification | submit verification |
| Committee member | assigned claims/evidence | discussion; own vote | no solo final decision |
| Review chair | committee claims/votes | review/decision | finalize decision |
| Organization admin | organization users/claims | assignments/content | organization scope only |
| Platform admin | audited support access | controlled configuration | platform-wide with audit |
| Public viewer | published/redacted views | none | none |

Authorization helper functions:

- `current_profile_id()`;
- `has_permission(permission_code, organization_id)`;
- `can_access_claim(claim_id)`;
- `is_active_member(organization_id)`.

The client uses only the public Supabase anon key with RLS. Service-role keys remain server-side.

## 12. Server functions/RPCs

Implement these transactionally and require an idempotency key for mobile retries:

- `create_claim_draft(payload)`;
- `submit_claim(claim_id, idempotency_key)`;
- `assign_claim(claim_id, officer_id)`;
- `start_verification(claim_id)`;
- `complete_verification(claim_id, checklist_payload)`;
- `open_committee_review(claim_id, meeting_id)`;
- `cast_committee_vote(review_id, vote, reason)`;
- `finalize_committee_decision(review_id, decision, reason)`;
- `publish_claim_to_map(claim_id, redaction_policy_version)`;
- `generate_scheme_recommendations(claim_id, rule_version)`;
- `create_signed_document_url(document_id)`;
- `request_data_export()`;
- `request_account_deletion()`.

## 13. Indexing and reporting

```sql
create index claims_org_status_idx
  on public.claims (organization_id, status, updated_at desc);

create index claims_assignee_status_idx
  on public.claims (assigned_officer_id, status, updated_at desc);

create index claim_documents_claim_idx
  on public.claim_documents (claim_id, verification_status);

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);

create index notifications_recipient_idx
  on public.notifications (recipient_id, read_at, created_at desc);

create index gis_features_geometry_idx
  on public.gis_features using gist (geometry);
```

Use cursor pagination by `(updated_at, id)`, avoid `select *` on sensitive tables, cache public summaries and use restricted reporting views:

- `reporting.dashboard_field_officer_stats`;
- `reporting.dashboard_committee_stats`;
- `reporting.dashboard_admin_stats`;
- `reporting.public_claim_summary`;
- `reporting.claim_timeline`;
- `reporting.service_status`;
- `reporting.scheme_recommendation_summary`.

## 14. Migration order

1. Enable `pgcrypto` and `postgis`.
2. Create organizations, profiles, roles, permissions and memberships.
3. Add authorization helpers and negative policy tests.
4. Create claims, parties, boundaries, documents and status history.
5. Create private storage buckets and storage RLS.
6. Add visits, checklists, meetings, reviews, attendance, votes and decisions.
7. Add schemes, rules and recommendations.
8. Add GIS layers/features/publications and redacted views.
9. Add notifications, devices, grievances and content.
10. Add audit, health checks and data-access requests.
11. Add indexes, reporting views and non-sensitive staging seeds.
12. Connect the web/mobile clients through typed service modules.

## 15. Required tests

### Authorization

- An applicant cannot read another applicant’s claim/document.
- A field officer cannot access claims outside assignment/jurisdiction.
- A committee member cannot finalize a decision alone.
- A public viewer cannot query private claims or storage paths.
- A suspended member loses access.

### Workflow and integrity

- Duplicate submit with the same idempotency key creates one claim.
- Invalid state transitions fail atomically.
- Rejection/return requires a reason.
- Final decisions are immutable and supersede rather than overwrite.
- Publication requires approval and redaction.
- Invalid/self-intersecting boundaries are rejected or quarantined.
- One-vote-per-member and quorum constraints hold under concurrency.

### Reliability and privacy

- Offline retries do not duplicate claims or votes.
- Signed URLs expire and cannot bypass RLS.
- Data export includes only the requester’s data.
- Deletion/anonymization preserves legally required audit history.

## 16. Definition of done

The database is production-ready when migrations are reproducible, RLS and negative authorization tests are green, all writes use server-side transactions, no production screen depends on hard-coded demo metrics, documents are private/scanned/retained correctly, public map data is explicitly redacted, claims/votes/decisions/role changes are auditable, backups and recovery objectives are documented, and staging/production are separated.

