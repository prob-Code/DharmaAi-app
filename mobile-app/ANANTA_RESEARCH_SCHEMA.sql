-- =====================================================================
-- ANANTA Research Persistence Schema (reviewable migration, v2)
-- =====================================================================
-- Owner: DharmaAI / ANANTA research workflow
--
-- IMPORTANT:
--   * This file is the reviewable migration artifact. It is NOT applied
--     automatically and must NOT be executed against the production
--     Supabase project without explicit human approval (see AGENTS.md).
--   * Schema uses the `ananta_` prefix so it never collides with the
--     existing social schema (profiles/posts/likes/etc.).
--   * RLS is enabled on every research table. Participants can only
--     reach their own research records via RLS policies.
--
-- PROTOCOL ENVELOPE (v2):
--   The database is the enforcement boundary for the research protocol.
--   Participants have NO direct INSERT/UPDATE/DELETE privileges on any
--   protocol table (enrollments, screenings, assessments, sessions,
--   transcripts). All protocol transitions must flow through the
--   narrowly scoped SECURITY DEFINER RPCs below, and each RPC re-checks
--   consent, screening eligibility, workflow phase, and ownership before
--   writing.
--     - ananta_record_consent        explicit consent op (gates everything)
--     - ananta_begin_research        NOT_STARTED -> DOMAIN_DISCOVERY
--     - ananta_record_screening      participant submits ADSS raw responses
--     - ananta_resolve_screening     staff only (service_role), not granted
--                                     to authenticated; sets status + score
--     - ananta_confirm_domain        requires status = 'eligible'
--     - ananta_begin_baseline        DOMAIN_CONFIRMED -> BASELINE_PENDING
--     - ananta_record_assessment     pre/post with phase + domain checks;
--                                     score is NEVER accepted from the client
--     - ananta_score_assessment      staff only; controlled score path
--     - ananta_start_session         1 requires baseline, 2 requires 1
--                                     completed, 3 requires 2 completed
--     - ananta_advance_session       OPENING -> ACTIVE -> CLOSING (one step)
--     - ananta_complete_session      CLOSING -> COMPLETED + summary
--     - ananta_append_transcript     atomic sequence + ownership check
--     - ananta_get_my_research_code  the only way to read research_code
--
-- HARDENING:
--   * Every SECURITY DEFINER function sets `search_path = ''` and fully
--     schema-qualifies all identifiers (`public.*`, `auth.uid()`,
--     `pg_catalog.*`) so callers cannot hijack search-path resolution.
--   * `EXECUTE` is revoked from PUBLIC/anon on all functions and granted
--     only where appropriate (authenticated for participant RPCs,
--     service_role for staff RPCs, nobody for internal helpers).
--   * research_code is generated server-side and is never readable via
--     table access (column-level select grants).
--   * Workflow phase, confirmed domain, screening, assessment and session
--     rows are write-restricted; RLS policies only expose SELECT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers (all SECURITY DEFINER, search_path hardened)
-- ---------------------------------------------------------------------

-- Server-side research code generator (reveals no identity).
create or replace function public.ananta_generate_research_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return 'AN-' || pg_catalog.upper(
    pg_catalog.substr(
      pg_catalog.md5(
        pg_catalog.random()::text || pg_catalog.clock_timestamp()::text
      ),
      1,
      12
    )
  );
end;
$$;

create or replace function public.ananta_set_research_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.research_code is null or NEW.research_code = '' then
    NEW.research_code := public.ananta_generate_research_code();
  end if;
  return NEW;
end;
$$;

create or replace function public.ananta_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  NEW.updated_at := pg_catalog.now();
  return NEW;
end;
$$;

-- Sanitized enrollment projection: never exposes research_code.
create or replace function public.ananta_enrollment_view(
  p_row public.ananta_enrollments
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return pg_catalog.jsonb_build_object(
    'id', p_row.id,
    'user_id', p_row.user_id,
    'consent_status', p_row.consent_status,
    'consent_signed_at', p_row.consent_signed_at,
    'workflow_phase', p_row.workflow_phase,
    'confirmed_domain', p_row.confirmed_domain,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
end;
$$;

-- Sanitized screening projection: raw_responses and score are never
-- returned to the participant client.
create or replace function public.ananta_screening_view(
  p_row public.ananta_screenings
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return pg_catalog.jsonb_build_object(
    'id', p_row.id,
    'participant_id', p_row.participant_id,
    'instrument_id', p_row.instrument_id,
    'instrument_version', p_row.instrument_version,
    'status', p_row.status,
    'completed_at', p_row.completed_at,
    'created_at', p_row.created_at
  );
end;
$$;

-- Assessment projection used only as the immediate write receipt.
create or replace function public.ananta_assessment_view(
  p_row public.ananta_assessments
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return pg_catalog.jsonb_build_object(
    'id', p_row.id,
    'participant_id', p_row.participant_id,
    'domain', p_row.domain,
    'instrument_id', p_row.instrument_id,
    'instrument_version', p_row.instrument_version,
    'role', p_row.role,
    'raw_responses', p_row.raw_responses,
    'score', p_row.score,
    'completed_at', p_row.completed_at,
    'metadata', p_row.metadata
  );
end;
$$;

create or replace function public.ananta_session_view(
  p_row public.ananta_sessions
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return pg_catalog.jsonb_build_object(
    'id', p_row.id,
    'participant_id', p_row.participant_id,
    'session_number', p_row.session_number,
    'status', p_row.status,
    'domain_snapshot', p_row.domain_snapshot,
    'started_at', p_row.started_at,
    'completed_at', p_row.completed_at,
    'summary', p_row.summary,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
end;
$$;

revoke all on function public.ananta_generate_research_code() from public, anon, authenticated;
revoke all on function public.ananta_set_research_code() from public, anon, authenticated;
revoke all on function public.ananta_touch_updated_at() from public, anon, authenticated;
revoke all on function public.ananta_enrollment_view(public.ananta_enrollments) from public, anon, authenticated;
revoke all on function public.ananta_screening_view(public.ananta_screenings) from public, anon, authenticated;
revoke all on function public.ananta_assessment_view(public.ananta_assessments) from public, anon, authenticated;
revoke all on function public.ananta_session_view(public.ananta_sessions) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- A. Research participant / enrollment
-- ---------------------------------------------------------------------

create table public.ananta_enrollments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  research_code text not null unique,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  consent_status text not null default 'none'
    check (consent_status in ('none', 'pending', 'consented', 'declined')),
  consent_signed_at timestamptz,
  workflow_phase text not null default 'NOT_STARTED'
    check (workflow_phase in (
      'NOT_STARTED', 'DOMAIN_DISCOVERY', 'DOMAIN_CONFIRMED',
      'BASELINE_PENDING', 'BASELINE_COMPLETED', 'SESSIONS_ACTIVE'
    )),
  confirmed_domain text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create trigger ananta_enrollments_set_research_code
  before insert on public.ananta_enrollments
  for each row execute procedure public.ananta_set_research_code();

create trigger ananta_enrollments_touch_updated
  before update on public.ananta_enrollments
  for each row execute procedure public.ananta_touch_updated_at();

alter table public.ananta_enrollments enable row level security;

revoke all on public.ananta_enrollments from anon, authenticated;

-- SELECT-only: the participant can read their own enrollment but can never
-- INSERT/UPDATE/DELETE it. Protocol transitions run through RPCs only.
grant select (id, user_id, consent_status, consent_signed_at, workflow_phase, confirmed_domain, created_at, updated_at)
  on public.ananta_enrollments to authenticated;

create policy "participants can view own enrollment"
  on public.ananta_enrollments for select
  to authenticated
  using (user_id = auth.uid());

-- Explicit consent op. Creates the enrollment if needed, always records the
-- consent timestamp, and is the only path to a 'consented' status.
create or replace function public.ananta_record_consent()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.ananta_enrollments;
begin
  if v_user is null then
    raise exception 'ananta_record_consent: caller is not authenticated';
  end if;

  insert into public.ananta_enrollments
    (user_id, research_code, consent_status, consent_signed_at)
  values (v_user, null, 'consented', pg_catalog.now())
  on conflict (user_id) do update
    set consent_status = 'consented',
        consent_signed_at = pg_catalog.now()
  returning * into v_row;

  return public.ananta_enrollment_view(v_row);
end;
$$;

revoke all on function public.ananta_record_consent() from public;
revoke execute on function public.ananta_record_consent() from anon;
grant execute on function public.ananta_record_consent() to authenticated;

-- NOT_STARTED -> DOMAIN_DISCOVERY. Refused without consent; idempotent
-- once discovery is already open.
create or replace function public.ananta_begin_research()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ananta_enrollments;
begin
  select e.* into v_row
    from public.ananta_enrollments e
   where e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_begin_research: no enrollment for this participant';
  end if;

  if v_row.consent_status <> 'consented' then
    raise exception 'ananta_begin_research: consent is required';
  end if;

  if v_row.workflow_phase = 'NOT_STARTED' then
    update public.ananta_enrollments set workflow_phase = 'DOMAIN_DISCOVERY'
      where id = v_row.id
      returning * into v_row;
  end if;

  return public.ananta_enrollment_view(v_row);
end;
$$;

revoke all on function public.ananta_begin_research() from public;
revoke execute on function public.ananta_begin_research() from anon;
grant execute on function public.ananta_begin_research() to authenticated;

-- The only way a participant can read their own research code back.
create or replace function public.ananta_get_my_research_code()
returns text
language sql
security definer
set search_path = ''
as $$
  select e.research_code
    from public.ananta_enrollments e
   where e.user_id = auth.uid()
$$;

revoke all on function public.ananta_get_my_research_code() from public;
revoke execute on function public.ananta_get_my_research_code() from anon;
grant execute on function public.ananta_get_my_research_code() to authenticated;

-- ---------------------------------------------------------------------
-- B. ADSS screening (before domain confirmation)
-- ---------------------------------------------------------------------

create table public.ananta_screenings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  participant_id uuid not null unique references public.ananta_enrollments(id) on delete cascade,
  instrument_id text not null,
  instrument_version text not null,
  raw_responses jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'eligible', 'not_eligible')),
  score jsonb,
  completed_at timestamptz not null default pg_catalog.now(),
  metadata jsonb
);

create index ananta_screenings_participant_idx on public.ananta_screenings (participant_id);

alter table public.ananta_screenings enable row level security;

revoke all on public.ananta_screenings from anon, authenticated;

-- SELECT-only with raw_responses/score excluded from participant reads.
grant select (id, participant_id, instrument_id, instrument_version, status, completed_at, created_at)
  on public.ananta_screenings to authenticated;

create policy "participants can view own screenings"
  on public.ananta_screenings for select
  to authenticated
  using (participant_id in (
    select id from public.ananta_enrollments where user_id = auth.uid()
  ));

-- Participant submission: stores raw responses as 'pending', never a score.
create or replace function public.ananta_record_screening(
  p_instrument_id text,
  p_instrument_version text,
  p_raw_responses jsonb,
  p_completed_at timestamptz default null,
  p_metadata jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.ananta_enrollments;
  v_row public.ananta_screenings;
begin
  select e.* into v_enrollment
    from public.ananta_enrollments e
   where e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_record_screening: no enrollment for this participant';
  end if;

  if v_enrollment.consent_status <> 'consented' then
    raise exception 'ananta_record_screening: consent is required';
  end if;

  if v_enrollment.workflow_phase <> 'DOMAIN_DISCOVERY' then
    raise exception 'ananta_record_screening: screening is only available during domain discovery';
  end if;

  if p_instrument_id is null
     or p_instrument_version is null
     or pg_catalog.length(pg_catalog.btrim(p_instrument_id)) = 0
     or pg_catalog.length(pg_catalog.btrim(p_instrument_version)) = 0 then
    raise exception 'ananta_record_screening: instrument identity is required';
  end if;

  insert into public.ananta_screenings
    (participant_id, instrument_id, instrument_version, raw_responses, status, completed_at, metadata)
  values (
    v_enrollment.id,
    p_instrument_id,
    p_instrument_version,
    p_raw_responses,
    'pending',
    coalesce(p_completed_at, pg_catalog.now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return public.ananta_screening_view(v_row);
end;
$$;

revoke all on function public.ananta_record_screening(text, text, jsonb, timestamptz, jsonb) from public;
revoke execute on function public.ananta_record_screening(text, text, jsonb, timestamptz, jsonb) from anon;
grant execute on function public.ananta_record_screening(text, text, jsonb, timestamptz, jsonb) to authenticated;

-- Staff-only resolution. NOT granted to authenticated: a participant can
-- never mark their own screening eligible or write a score.
create or replace function public.ananta_resolve_screening(
  p_screening_id uuid,
  p_status text,
  p_score jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ananta_screenings;
begin
  if p_status not in ('eligible', 'not_eligible') then
    raise exception 'ananta_resolve_screening: status must be eligible or not_eligible';
  end if;

  update public.ananta_screenings set status = p_status, score = p_score
    where id = p_screening_id
    returning * into v_row;

  if not found then
    raise exception 'ananta_resolve_screening: screening not found';
  end if;

  return public.ananta_screening_view(v_row);
end;
$$;

revoke all on function public.ananta_resolve_screening(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.ananta_resolve_screening(uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- C. Domain confirmation
-- ---------------------------------------------------------------------

-- Requires a consented enrollment, the discovery phase, a non-empty domain,
-- and a screening resolved to 'eligible'. Freezes confirmed_domain.
create or replace function public.ananta_confirm_domain(
  p_domain text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.ananta_enrollments;
  v_eligible boolean;
begin
  select e.* into v_enrollment
    from public.ananta_enrollments e
   where e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_confirm_domain: no enrollment for this participant';
  end if;

  if v_enrollment.consent_status <> 'consented' then
    raise exception 'ananta_confirm_domain: consent is required';
  end if;

  if v_enrollment.workflow_phase <> 'DOMAIN_DISCOVERY' then
    raise exception 'ananta_confirm_domain: domain confirmation requires the discovery phase';
  end if;

  if p_domain is null or pg_catalog.length(pg_catalog.btrim(p_domain)) = 0 then
    raise exception 'ananta_confirm_domain: a non-empty domain is required';
  end if;

  select exists (
    select 1 from public.ananta_screenings sc
     where sc.participant_id = v_enrollment.id
       and sc.status = 'eligible'
  ) into v_eligible;

  if not v_eligible then
    raise exception 'ananta_confirm_domain: a valid screening result is required';
  end if;

  update public.ananta_enrollments
     set workflow_phase = 'DOMAIN_CONFIRMED',
         confirmed_domain = p_domain
   where id = v_enrollment.id
   returning * into v_enrollment;

  return public.ananta_enrollment_view(v_enrollment);
end;
$$;

revoke all on function public.ananta_confirm_domain(text) from public;
revoke execute on function public.ananta_confirm_domain(text) from anon;
grant execute on function public.ananta_confirm_domain(text) to authenticated;

-- DOMAIN_CONFIRMED -> BASELINE_PENDING. Opens the baseline (pre-test) window;
-- the pre assessment can only be recorded while this phase is active.
create or replace function public.ananta_begin_baseline()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ananta_enrollments;
begin
  select e.* into v_row
    from public.ananta_enrollments e
   where e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_begin_baseline: no enrollment for this participant';
  end if;

  if v_row.consent_status <> 'consented' then
    raise exception 'ananta_begin_baseline: consent is required';
  end if;

  if v_row.workflow_phase <> 'DOMAIN_CONFIRMED' then
    raise exception 'ananta_begin_baseline: baseline requires a confirmed research domain';
  end if;

  update public.ananta_enrollments
     set workflow_phase = 'BASELINE_PENDING'
   where id = v_row.id
   returning * into v_row;

  return public.ananta_enrollment_view(v_row);
end;
$$;

revoke all on function public.ananta_begin_baseline() from public;
revoke execute on function public.ananta_begin_baseline() from anon;
grant execute on function public.ananta_begin_baseline() to authenticated;

-- ---------------------------------------------------------------------
-- D. Baseline / assessment records (pre / post, one per role)
-- ---------------------------------------------------------------------

create table public.ananta_assessments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  participant_id uuid not null references public.ananta_enrollments(id) on delete cascade,
  domain text not null,
  instrument_id text not null,
  instrument_version text not null,
  role text not null check (role in ('pre', 'post')),
  raw_responses jsonb,
  score jsonb,                 -- written only by the controlled staff path
  completed_at timestamptz not null default pg_catalog.now(),
  metadata jsonb,
  unique (participant_id, role)
);

create index ananta_assessments_participant_idx on public.ananta_assessments (participant_id);

alter table public.ananta_assessments enable row level security;

revoke all on public.ananta_assessments from anon, authenticated;

-- SELECT-only with raw_responses/score/metadata excluded from participant reads.
grant select (id, participant_id, domain, instrument_id, instrument_version, role, completed_at)
  on public.ananta_assessments to authenticated;

create policy "participants can view own assessments"
  on public.ananta_assessments for select
  to authenticated
  using (participant_id in (
    select id from public.ananta_enrollments where user_id = auth.uid()
  ));

-- Participant assessment submission. Validates role against the workflow
-- phase, validates the domain equals the frozen confirmation, atomically
-- advances the pre-test window, and NEVER records a client-supplied score.
create or replace function public.ananta_record_assessment(
  p_role text,
  p_domain text,
  p_instrument_id text,
  p_instrument_version text,
  p_raw_responses jsonb default null,
  p_completed_at timestamptz default null,
  p_metadata jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.ananta_enrollments;
  v_assessment public.ananta_assessments;
  v_third_completed boolean;
begin
  select e.* into v_enrollment
    from public.ananta_enrollments e
   where e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_record_assessment: no enrollment for this participant';
  end if;

  if v_enrollment.consent_status <> 'consented' then
    raise exception 'ananta_record_assessment: consent is required';
  end if;

  if p_role not in ('pre', 'post') then
    raise exception 'ananta_record_assessment: invalid role';
  end if;

  if v_enrollment.confirmed_domain is null
     or p_domain is null
     or p_domain <> v_enrollment.confirmed_domain then
    raise exception 'ananta_record_assessment: domain must equal the confirmed research domain';
  end if;

  if p_role = 'pre' then
    if v_enrollment.workflow_phase <> 'BASELINE_PENDING' then
      raise exception 'ananta_record_assessment: the pre assessment requires the baseline pending phase';
    end if;
  else
    if v_enrollment.workflow_phase <> 'SESSIONS_ACTIVE' then
      raise exception 'ananta_record_assessment: the post assessment requires sessions to have started';
    end if;

    select exists (
      select 1 from public.ananta_sessions s
       where s.participant_id = v_enrollment.id
         and s.session_number = 3
         and s.status = 'COMPLETED'
    ) into v_third_completed;

    if not v_third_completed then
      raise exception 'ananta_record_assessment: the post assessment requires a completed session 3';
    end if;
  end if;

  insert into public.ananta_assessments
    (participant_id, domain, instrument_id, instrument_version, role, raw_responses, score, completed_at, metadata)
  values (
    v_enrollment.id,
    p_domain,
    p_instrument_id,
    p_instrument_version,
    p_role,
    p_raw_responses,
    null,
    coalesce(p_completed_at, pg_catalog.now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_assessment;

  if p_role = 'pre' then
    update public.ananta_enrollments set workflow_phase = 'BASELINE_COMPLETED'
      where id = v_enrollment.id;
  end if;

  select e.* into v_enrollment
    from public.ananta_enrollments e
   where e.id = v_enrollment.id;

  return pg_catalog.jsonb_build_object(
    'assessment', public.ananta_assessment_view(v_assessment),
    'enrollment', public.ananta_enrollment_view(v_enrollment)
  );
end;
$$;

revoke all on function public.ananta_record_assessment(text, text, text, text, jsonb, timestamptz, jsonb) from public;
revoke execute on function public.ananta_record_assessment(text, text, text, text, jsonb, timestamptz, jsonb) from anon;
grant execute on function public.ananta_record_assessment(text, text, text, text, jsonb, timestamptz, jsonb) to authenticated;

-- Staff-only controlled scoring path. NOT granted to authenticated.
create or replace function public.ananta_score_assessment(
  p_assessment_id uuid,
  p_score jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ananta_assessments;
begin
  update public.ananta_assessments set score = p_score
    where id = p_assessment_id
    returning * into v_row;

  if not found then
    raise exception 'ananta_score_assessment: assessment not found';
  end if;

  return public.ananta_assessment_view(v_row);
end;
$$;

revoke all on function public.ananta_score_assessment(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ananta_score_assessment(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- E. Research sessions (one record per participant/session number)
-- ---------------------------------------------------------------------

create table public.ananta_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  participant_id uuid not null references public.ananta_enrollments(id) on delete cascade,
  session_number int not null check (session_number between 1 and 3),
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'OPENING', 'ACTIVE', 'CLOSING', 'COMPLETED')),
  domain_snapshot text,
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (participant_id, session_number)
);

create index ananta_sessions_participant_idx on public.ananta_sessions (participant_id);

create trigger ananta_sessions_touch_updated
  before update on public.ananta_sessions
  for each row execute procedure public.ananta_touch_updated_at();

alter table public.ananta_sessions enable row level security;

revoke all on public.ananta_sessions from anon, authenticated;

-- SELECT-only: participants can never create or modify session rows directly.
grant select (id, participant_id, session_number, status, domain_snapshot, started_at, completed_at, summary, created_at, updated_at)
  on public.ananta_sessions to authenticated;

create policy "participants can view own sessions"
  on public.ananta_sessions for select
  to authenticated
  using (participant_id in (
    select id from public.ananta_enrollments where user_id = auth.uid()
  ));

-- Session creation is DB-gated: 1 requires BASELINE_COMPLETED, 2 requires
-- session 1 COMPLETED, 3 requires session 2 COMPLETED. The domain snapshot
-- is always taken from the frozen confirmation and is never client-supplied.
create or replace function public.ananta_start_session(
  p_session_number integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.ananta_enrollments;
  v_row public.ananta_sessions;
  v_previous_completed integer;
begin
  select e.* into v_enrollment
    from public.ananta_enrollments e
   where e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_start_session: no enrollment for this participant';
  end if;

  if v_enrollment.consent_status <> 'consented' then
    raise exception 'ananta_start_session: consent is required';
  end if;

  if v_enrollment.confirmed_domain is null then
    raise exception 'ananta_start_session: a confirmed research domain is required';
  end if;

  if p_session_number is null or p_session_number < 1 or p_session_number > 3 then
    raise exception 'ananta_start_session: session number must be between 1 and 3';
  end if;

  if p_session_number = 1 then
    if v_enrollment.workflow_phase <> 'BASELINE_COMPLETED' then
      raise exception 'ananta_start_session: session 1 requires a completed baseline';
    end if;
    update public.ananta_enrollments set workflow_phase = 'SESSIONS_ACTIVE'
      where id = v_enrollment.id;
  else
    select pg_catalog.count(*) into v_previous_completed
      from public.ananta_sessions s
     where s.participant_id = v_enrollment.id
       and s.session_number = p_session_number - 1
       and s.status = 'COMPLETED';

    if v_previous_completed = 0 then
      raise exception 'ananta_start_session: session % requires a completed session %',
        p_session_number, p_session_number - 1;
    end if;
  end if;

  insert into public.ananta_sessions
    (participant_id, session_number, status, domain_snapshot, started_at)
  values (
    v_enrollment.id,
    p_session_number,
    'OPENING',
    v_enrollment.confirmed_domain,
    pg_catalog.now()
  )
  returning * into v_row;

  select e.* into v_enrollment
    from public.ananta_enrollments e
   where e.id = v_enrollment.id;

  return pg_catalog.jsonb_build_object(
    'session', public.ananta_session_view(v_row),
    'enrollment', public.ananta_enrollment_view(v_enrollment)
  );
end;
$$;

revoke all on function public.ananta_start_session(integer) from public;
revoke execute on function public.ananta_start_session(integer) from anon;
grant execute on function public.ananta_start_session(integer) to authenticated;

-- Strict one-step transitions: OPENING -> ACTIVE or ACTIVE -> CLOSING.
create or replace function public.ananta_advance_session(
  p_session_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ananta_sessions;
  v_next text;
begin
  select s.* into v_row
    from public.ananta_sessions s
    join public.ananta_enrollments e on e.id = s.participant_id
   where s.id = p_session_id
     and e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_advance_session: session not found or not owned';
  end if;

  if v_row.status = 'OPENING' then
    v_next := 'ACTIVE';
  elsif v_row.status = 'ACTIVE' then
    v_next := 'CLOSING';
  else
    raise exception 'ananta_advance_session: cannot advance from the % phase', v_row.status;
  end if;

  update public.ananta_sessions set status = v_next
    where id = p_session_id
    returning * into v_row;

  return public.ananta_session_view(v_row);
end;
$$;

revoke all on function public.ananta_advance_session(uuid) from public;
revoke execute on function public.ananta_advance_session(uuid) from anon;
grant execute on function public.ananta_advance_session(uuid) to authenticated;

-- CLOSING -> COMPLETED with the closure summary.
create or replace function public.ananta_complete_session(
  p_session_id uuid,
  p_summary jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ananta_sessions;
begin
  select s.* into v_row
    from public.ananta_sessions s
    join public.ananta_enrollments e on e.id = s.participant_id
   where s.id = p_session_id
     and e.user_id = auth.uid();

  if not found then
    raise exception 'ananta_complete_session: session not found or not owned';
  end if;

  if v_row.status <> 'CLOSING' then
    raise exception 'ananta_complete_session: session must be closing before completion';
  end if;

  update public.ananta_sessions
     set status = 'COMPLETED',
         summary = p_summary,
         completed_at = pg_catalog.now()
   where id = p_session_id
   returning * into v_row;

  return public.ananta_session_view(v_row);
end;
$$;

revoke all on function public.ananta_complete_session(uuid, jsonb) from public;
revoke execute on function public.ananta_complete_session(uuid, jsonb) from anon;
grant execute on function public.ananta_complete_session(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- F. Transcript / event records (session reconstruction)
-- ---------------------------------------------------------------------

create table public.ananta_transcripts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  session_id uuid not null references public.ananta_sessions(id) on delete cascade,
  sequence_number int not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default pg_catalog.now(),
  metadata jsonb,
  unique (session_id, sequence_number)
);

create index ananta_transcripts_session_idx on public.ananta_transcripts (session_id);
create index ananta_transcripts_session_seq_idx on public.ananta_transcripts (session_id, sequence_number);

alter table public.ananta_transcripts enable row level security;

revoke all on public.ananta_transcripts from anon, authenticated;

grant select (id, session_id, sequence_number, role, content, created_at, metadata)
  on public.ananta_transcripts to authenticated;

create policy "participants can view own transcripts"
  on public.ananta_transcripts for select
  to authenticated
  using (session_id in (
    select s.id
      from public.ananta_sessions s
      join public.ananta_enrollments e on e.id = s.participant_id
     where e.user_id = auth.uid()
  ));

-- No direct INSERT/UPDATE/DELETE policies: writes go through the security
-- definer append function below (atomic sequence allocation + explicit
-- ownership check).
create or replace function public.ananta_append_transcript(
  p_session_id uuid,
  p_role text,
  p_content text,
  p_created_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ananta_transcripts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant uuid;
  v_sequence int;
  v_row public.ananta_transcripts;
begin
  -- Explicit ownership check: security definer bypasses RLS, so the
  -- caller must own the session before any write is accepted.
  select s.participant_id into v_participant
    from public.ananta_sessions s
    join public.ananta_enrollments e on e.id = s.participant_id
   where s.id = p_session_id
     and e.user_id = auth.uid();

  if v_participant is null then
    raise exception 'ananta_transcript: session not found or not owned';
  end if;

  for attempt in 1..5 loop
    select coalesce(pg_catalog.max(t.sequence_number), 0) + 1 into v_sequence
      from public.ananta_transcripts t
     where t.session_id = p_session_id;

    begin
      insert into public.ananta_transcripts
        (session_id, sequence_number, role, content, created_at, metadata)
      values (
        p_session_id,
        v_sequence,
        p_role,
        p_content,
        coalesce(p_created_at, pg_catalog.now()),
        coalesce(p_metadata, '{}'::jsonb)
      )
      returning * into v_row;

      return v_row;
    exception
      when unique_violation then
        -- Concurrent append claimed this sequence; retry with a fresh one.
        continue;
    end;
  end loop;

  raise exception 'ananta_transcript: could not allocate a sequence number';
end;
$$;

revoke all on function public.ananta_append_transcript(uuid, text, text, timestamptz, jsonb) from public;
revoke execute on function public.ananta_append_transcript(uuid, text, text, timestamptz, jsonb) from anon;
grant execute on function public.ananta_append_transcript(uuid, text, text, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- G. Feedback
-- ---------------------------------------------------------------------

create table public.ananta_feedback (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  participant_id uuid not null references public.ananta_enrollments(id) on delete cascade,
  session_id uuid references public.ananta_sessions(id) on delete set null,
  category text not null,      -- application-level category (e.g. 'session', 'companion')
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default pg_catalog.now()
);

create index ananta_feedback_participant_idx on public.ananta_feedback (participant_id);
create index ananta_feedback_session_idx on public.ananta_feedback (session_id);

alter table public.ananta_feedback enable row level security;

revoke all on public.ananta_feedback from anon, authenticated;

grant select on public.ananta_feedback to authenticated;
grant insert (participant_id, session_id, category, rating, comment)
  on public.ananta_feedback to authenticated;

create policy "participants can view own feedback"
  on public.ananta_feedback for select
  to authenticated
  using (participant_id in (
    select id from public.ananta_enrollments where user_id = auth.uid()
  ));

create policy "participants can create own feedback"
  on public.ananta_feedback for insert
  to authenticated
  with check (
    participant_id in (
      select id from public.ananta_enrollments where user_id = auth.uid()
    )
    and (
      session_id is null
      or session_id in (
        select s.id
          from public.ananta_sessions s
         where s.participant_id = participant_id
      )
    )
  );

-- ---------------------------------------------------------------------
-- Notes for operators
-- ---------------------------------------------------------------------
-- * service_role continues to hold full privileges on all of the above
--   tables and functions by default, which covers research export and
--   any future researcher/admin tooling. Staff RPCs (resolve_screening,
--   score_assessment) are granted to service_role only.
-- * The research_code <-> auth identity linkage is deliberately more
--   restricted than ordinary participant data: participants can never
--   SELECT or UPDATE research_code directly; it is exposed only through
--   public.ananta_get_my_research_code().
-- * Consent must be recorded through public.ananta_record_consent() before
--   any protocol step; begin_research refuses otherwise.
-- * Screening resolution and assessment scoring are staff-only. This app
--   layer holds no scoring logic and never writes a score.
-- * A future researcher role could be granted reverse (anonymised) read
--   access here without changing participant RLS. Do not broaden
--   participant policies for that purpose.