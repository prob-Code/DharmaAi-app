-- =====================================================================
-- ANANTA Research Schema tests (reviewable, run in a SCRATCH database)
-- =====================================================================
-- Purpose: assert the research-integrity/security invariants of
-- ANANTA_RESEARCH_SCHEMA.sql so the protocol boundary is verifiable.
--
-- IMPORTANT:
--   * REVIEWABLE ONLY. Do NOT run this against the production Supabase
--     project (mtiltptnumjoaibgpvzb). Run it in a scratch/test Postgres
--     database AFTER applying ANANTA_RESEARCH_SCHEMA.sql there.
--   * The DO blocks below are read-only (catalog checks) and safe.
--   * The transactional psql flow test at the bottom is a documented
--     template and requires a scratch database with a seeded auth.users
--     row (a mock auth.uid() provider) to execute; it is left commented
--     out so this artifact stays inert by default.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Every ananta_* table has RLS enabled
-- ---------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select pg_catalog.count(*) into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname like 'ananta_%'
     and not c.relrowsecurity;

  if v_bad > 0 then
    raise exception '% ananta tables have RLS disabled', v_bad;
  end if;

  raise notice 'ok: row level security enabled on all ananta tables';
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Every SECURITY DEFINER ananta_* function sets search_path = ''
-- ---------------------------------------------------------------------
do $$
declare
  v_defined integer;
  v_hardened integer;
  v_bad integer;
begin
  select pg_catalog.count(*) into v_defined
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'ananta_%'
     and p.prosecdef;

  select pg_catalog.count(*) into v_bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'ananta_%'
     and p.prosecdef
     and not ('search_path=' = any(p.proconfig));

  if v_defined = 0 then
    raise exception 'no security definer ananta functions found';
  end if;

  if v_bad > 0 then
    raise exception '% security definer ananta functions lack the hardened search_path', v_bad;
  end if;

  raise notice 'ok: % security definer ananta functions hardened with search_path=''''', v_defined;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Authenticated has NO direct write privileges on any protocol table
--    (feedback keeps its insert grant and is the documented exception)
-- ---------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select pg_catalog.count(*) into v_bad
    from information_schema.role_table_grants g
   where g.grantee = 'authenticated'
     and g.table_schema = 'public'
     and g.table_name like 'ananta_%'
     and g.table_name <> 'ananta_feedback'
     and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE');

  if v_bad > 0 then
    raise exception '% direct protocol write privileges granted to authenticated', v_bad;
  end if;

  raise notice 'ok: authenticated holds no direct protocol table writes';
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Restricted columns are NOT selectable by authenticated
-- ---------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select pg_catalog.count(*) into v_bad
    from information_schema.role_column_grants g
   where g.grantee = 'authenticated'
     and g.table_schema = 'public'
     and (
       (g.table_name = 'ananta_screenings'
        and g.column_name in ('raw_responses', 'score', 'metadata'))
       or (g.table_name = 'ananta_assessments'
           and g.column_name in ('raw_responses', 'score', 'metadata'))
       or (g.table_name = 'ananta_enrollments'
           and g.column_name = 'research_code')
     );

  if v_bad > 0 then
    raise exception '% restricted columns are selectable by authenticated', v_bad;
  end if;

  raise notice 'ok: restricted columns hidden from authenticated selects';
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Staff-only functions are executable by service_role but NEVER by
--    authenticated / anon / public
-- ---------------------------------------------------------------------
do $$
declare
  v_missing_service integer;
  v_leaked_authenticated integer;
  v_leaked_anon integer;
begin
  select pg_catalog.count(*) into v_missing_service
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('ananta_resolve_screening', 'ananta_score_assessment')
     and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE');

  if v_missing_service > 0 then
    raise exception 'staff functions are not executable by service_role';
  end if;

  select pg_catalog.count(*) into v_leaked_authenticated
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('ananta_resolve_screening', 'ananta_score_assessment')
     and (
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
     );

  if v_leaked_authenticated > 0 then
    raise exception 'staff functions are executable by a non-staff role';
  end if;

  raise notice 'ok: staff functions restricted to service_role';
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Participant RPCs are executable by authenticated and never by anon
--    or public
-- ---------------------------------------------------------------------
do $$
declare
  v_missing integer;
  v_leaked_anon integer;
  v_leaked_public integer;
begin
  select pg_catalog.count(*) into v_missing
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'ananta_record_consent', 'ananta_begin_research',
       'ananta_record_screening', 'ananta_confirm_domain',
       'ananta_begin_baseline', 'ananta_record_assessment',
       'ananta_start_session', 'ananta_advance_session',
       'ananta_complete_session', 'ananta_append_transcript',
       'ananta_get_my_research_code'
     )
     and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if v_missing > 0 then
    raise exception 'participant RPCs are not executable by authenticated';
  end if;

  select pg_catalog.count(*) into v_leaked_anon
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'ananta_record_consent', 'ananta_begin_research',
       'ananta_record_screening', 'ananta_confirm_domain',
       'ananta_begin_baseline', 'ananta_record_assessment',
       'ananta_start_session', 'ananta_advance_session',
       'ananta_complete_session', 'ananta_append_transcript',
       'ananta_get_my_research_code'
     )
     and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_leaked_anon > 0 then
    raise exception 'anon can execute participant RPCs';
  end if;

  select pg_catalog.count(*) into v_leaked_public
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'ananta_%'
     and pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE');

  if v_leaked_public > 0 then
    raise exception 'public can execute ananta functions';
  end if;

  raise notice 'ok: participant RPC surface is scoped correctly';
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Unique invariants exist for one-row-per-(participant, protocol slot)
-- ---------------------------------------------------------------------
do $$
declare
  v int;
begin
  select pg_catalog.count(*) into v
    from pg_catalog.pg_constraint
   where conname = 'ananta_screenings_participant_id_key' and contype = 'u';
  if v <> 1 then
    raise exception 'missing unique participant_id on ananta_screenings';
  end if;

  select pg_catalog.count(*) into v
    from pg_catalog.pg_constraint
   where conname = 'ananta_assessments_participant_id_role_key' and contype = 'u';
  if v <> 1 then
    raise exception 'missing unique (participant_id, role) on ananta_assessments';
  end if;

  select pg_catalog.count(*) into v
    from pg_catalog.pg_constraint
   where conname = 'ananta_sessions_participant_id_session_number_key' and contype = 'u';
  if v <> 1 then
    raise exception 'missing unique (participant_id, session_number) on ananta_sessions';
  end if;

  select pg_catalog.count(*) into v
    from pg_catalog.pg_constraint
   where conname = 'ananta_transcripts_session_id_sequence_number_key' and contype = 'u';
  if v <> 1 then
    raise exception 'missing unique (session_id, sequence_number) on ananta_transcripts';
  end if;

  raise notice 'ok: unique protocol-slot constraints present';
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Transactional protocol-flow test (TEMPLATE - disabled by default)
-- ---------------------------------------------------------------------
-- Running this requires a scratch database where ANANTA_RESEARCH_SCHEMA.sql
-- has been applied and where auth.uid() can be faked (e.g. a prepared
-- statement that sets request.jwt.claim.sub to a seeded auth.users id).
--
-- begin;
--   -- set the JWT subject for this transaction:
--   select set_config('request.jwt.claim.sub', :'participant_user_id', true);
--
--   -- consent -> discovery -> screening (participant path)
--   select public.ananta_record_consent();
--   select public.ananta_begin_research();
--   select public.ananta_record_screening('adss-v1', '1.0.0',
--         '{"q1":2,"q2":3}'::jsonb, now(), null);
--
--   -- staff path (exercised under a service_role-capable session):
--   -- select public.ananta_resolve_screening(<screening_id>, 'eligible', '{"total":7}'::jsonb);
--
--   select public.ananta_confirm_domain('work-life balance');
--   select public.ananta_begin_baseline();
--   select public.ananta_record_assessment('pre', 'work-life balance',
--         'baseline-pre', 'v1', '{"q1":1}'::jsonb, now(), null);
--   select public.ananta_start_session(1);
--   -- ... advance -> complete session 1 -> start 2 -> complete -> start 3 -> complete
--   select public.ananta_record_assessment('post', 'work-life balance',
--         'baseline-post', 'v1', '{"q1":4}'::jsonb, now(), null);
--
--   -- negative checks (expect raised exceptions):
--   -- select public.ananta_begin_baseline();          -- not DOMAIN_CONFIRMED (double)
--   -- select public.ananta_start_session(2);          -- session 1 not completed
--   -- select public.ananta_start_session(9);          -- out of range
-- rollback;
-- =====================================================================
-- End of ANANTA research schema tests.