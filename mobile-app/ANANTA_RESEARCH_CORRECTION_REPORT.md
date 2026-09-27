# ANANTA Research Correction Pass — Report

Status: reviewable deliverable. Nothing in this pass has been executed against
Supabase (project `mtiltptnumjoaibgpvzb`) and nothing has been committed or
pushed. The migration artifact must not be auto-applied to production without
explicit human approval (AGENTS.md).

## Objective

Re-architect the ANANTA research integration so the **database is the protocol
enforcement boundary** instead of the client. Participants no longer hold any
direct INSERT/UPDATE/DELETE privilege on protocol tables; every transition is an
RPC that re-checks consent, screening eligibility, workflow phase, ownership and
the frozen research domain before writing. Scoring stays staff-only and is never
client-trusted.

## Files written in this pass

| File | Change |
| --- | --- |
| `mobile-app/services/research/researchTypes.ts` | Rewritten: `ScreeningStatus`, participant-visible `ScreeningRow`, `ScreeningSubmission`, score-less `AssessmentSubmission`, `ParticipantAssessmentRow` (read-model shape), `RecordAssessmentOutput`, `StartSessionOutput`, `ResearchStateReadModel` (now includes `screening`); removed `EnrollmentInsert/Update`, `SessionInsert/Update` |
| `mobile-app/services/research/researchMapping.ts` | Trimmed to kept helpers; added `assessmentSubmissionToBaselineRecord`; removed `workflowToEnrollmentPatch`, `baselineRecordToAssessmentInsert`, `sessionToSessionRowPatch`, `sessionForInsert`, `enrollmentForUser` (direct-write clients are gone) |
| `mobile-app/services/research/researchPersistence.ts` | Rewritten as an RPC-based `ResearchPersistence`; `isUniqueViolation`; `rpcEnvelope`; lazy default via dynamic `import('../supabase')`; read-model assessment projection restricted to participant-visible columns |
| `mobile-app/services/research/researchController.ts` | Rewritten: consent/screening/post methods, gates, persist-first semantics, `isUniqueViolation` recovery; `ResearchSnapshot` includes the screening row |
| `mobile-app/services/research/researchTestHarness.ts` | Rewritten: full fake RPC rule emulation, sanitized views, `setFakeAuthUser`, `resolveScreeningForTest`, repaired `makeScreeningSubmission` typing |
| `mobile-app/services/research/researchMapping.test.ts` | Rewritten |
| `mobile-app/services/research/researchPersistence.test.ts` | Rewritten |
| `mobile-app/services/research/researchController.test.ts` | Rewritten |
| `mobile-app/ANANTA_RESEARCH_SCHEMA.sql` | Rewritten (v2) reviewable migration |
| `mobile-app/ANANTA_RESEARCH_SCHEMA_TESTS.sql` | New: catalog-invariant DO-block tests + documented psql flow template |

## Corrections made

- **Wire-to-DB protocol writes removed.** The old persistence/mapping surface
  implied direct inserts/updates on protocol tables (statements like
  "insert into .localState" and per-row patch helpers). All protocol transitions
  now go through RPCs only.
- **Session confinement.** The old session records could be created in an
  arbitrary state (`CONFIRMED`). Sessions now model start/advance/complete as
  the DB-gated `ananta_start_session` / `ananta_advance_session` /
  `ananta_complete_session` trio with `NOT_STARTED -> OPENING -> ACTIVE ->
  CLOSING -> COMPLETED`, one-step advances, and 1→2→3 ordering.
- **Screening is participant-writable, resolution is not.** `ananta_record_screening`
  accepts raw responses as `pending`; `ananta_resolve_screening` (status + score)
  is granted to `service_role` only.
- **Score never trusted.** `ananta_record_assessment` always records `score =
  null`; `ananta_score_assessment` is staff-only. `AssessmentSubmission` has no
  score field.
- **domain locked by DB.** `ananta_confirm_domain` requires an eligible screening
  and freezes `confirmed_domain`; later RPCs compare the submitted domain to it.
- **read-model assessment hides restricted columns.** The direct assessment
  SELECT now requests only `(id, participant_id, domain, instrument_id,
  instrument_version, role, completed_at)`, matching the SQL column grant;
  the read model's baseline is the participant-visible `ParticipantAssessmentRow`
  (fixes a real mismatch where the app selected `raw_responses/score/metadata`
  that the DB would not grant).
- **Hardening.** Every SECURITY DEFINER function sets `search_path = ''` and
  schema-qualifies all identifiers; EXECUTE revoked from public/anon on all
  functions; column-level SELECT grants exclude `research_code`,
  `raw_responses`, `score`; RLS SELECT-only policies on protocol tables;
  `ananta_append_transcript` adds an explicit ownership check plus a
  unique-violation retry loop for sequence allocation.
- **Controller gates.** `requireEligibleScreening`, consent checks, frozen-domain
  check in `completeBaseline`/`completePostAssessment`, session ordering via
  `advanceActiveSession`/`completeActiveSession`.

## Validation

- `tsc.cmd --noEmit` — clean (no output)
- `researchMapping.test.ts` — passed
- `researchPersistence.test.ts` — passed
- `researchController.test.ts` — passed
- `researchWorkflow.test.ts` (companion, untouched) — exit 0
- `researchLifecycle.test.ts` (companion, untouched) — exit 0
- `git diff --check` — clean
- No SQL was executed against any database; the schema/test SQL files are
  review-only.

## Remaining risks / notes

- The SQL migration has never been run. The `TS` layer is validated only
  against the fake harness; the harness approximates Postgres semantics, so
  structural drift is possible. Review `ANANTA_RESEARCH_SCHEMA_TESTS.sql` against
  a scratch Postgres instance before any production plan.
- `service_role` retains full table privileges by design (research export,
  researcher tooling). The staff RPCs are the only sanctioned write paths and
  are not client-callable.
- The read-model baseline no longer carries raw responses or score; hydration
  relies only on the participant-visible fields. Any future UI that re-displays
  baseline answers across reloads must persist them client-side.
- Consent is `consented`/`declined`/`pending`/`none` on the enrollment row;
  there is no separate consent version history table — acceptable for the
  current three-session protocol, expandable later under the same RPC boundary.
- Untracked artifacts (`ANANTA_*.sql`, `ANANTA_DESIGN_CONSTITUTION.md`,
  `ANANTA_EXISTING_UI_INVENTORY.md`, `services/research/`) are intentionally
  left un-staged; no commits were made.

## Suggested next steps

1. Review `ANANTA_RESEARCH_SCHEMA.sql` (v2) and run the DO-block tests in
   `ANANTA_RESEARCH_SCHEMA_TESTS.sql` on a scratch Postgres instance.
2. On approval, apply the migration to the Supabase project inside a CI-replayed
   migration, then run the harness tests against a real client.
3. Commit the parent-repo artifacts on the feature branch once the user gives the
   go-ahead.