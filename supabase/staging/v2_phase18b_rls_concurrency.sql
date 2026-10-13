-- STAGING ONLY, NOT EXECUTED. Run in a disposable staging DB with Phase 18B SQL applied.
-- Example: psql "$STAGING_URL" -v ON_ERROR_STOP=1 \
--   -v workspace_a=UUID -v workspace_b=UUID -v subject_routine_a=UUID \
--   -v member_a_uid=UUID -v member_b_uid=UUID -v outsider_uid=UUID \
--   -f supabase/staging/v2_phase18b_rls_concurrency.sql
-- Preflight: A and B are active members of workspace A; outsider is not.
-- workspace B is different; routine subject is in workspace A, active,
-- and has no visual_overrides row yet. All writes ROLLBACK at the end.
BEGIN;
SET LOCAL ROLE authenticated;
select set_config('hc.workspace_a', :'workspace_a', true);
select set_config('hc.workspace_b', :'workspace_b', true);
select set_config('hc.subject_a', :'subject_routine_a', true);
select set_config('request.jwt.claim.sub', :'member_a_uid', true);
DO $$ BEGIN
 IF not public.is_workspace_member(current_setting('hc.workspace_a')::uuid) THEN RAISE EXCEPTION 'Fixture A is not member'; END IF;
 IF exists(select 1 from public.visual_overrides where workspace_id=current_setting('hc.workspace_b')::uuid) THEN
   RAISE EXCEPTION 'RLS failure: A can read cross-workspace rows';
 END IF;
 BEGIN
   insert into public.visual_overrides(workspace_id,subject_type,subject_id,generator_version,schema_version,overrides_json,revision,last_mutation_id,updated_by)
   values (current_setting('hc.workspace_a')::uuid,'routine',current_setting('hc.subject_a')::uuid,2,1,'{}',1,gen_random_uuid(),auth.uid());
   RAISE EXCEPTION 'Direct writes were incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- User A creates artwork using the only allowed write path.
SELECT public.v2_commit_visual_override(:'workspace_a'::uuid,'routine',:'subject_routine_a'::uuid,
  0,2,'{"pose":"thumbs-up"}'::jsonb,'11111111-1111-4111-8111-111111111111'::uuid);
-- Idempotency: identical request does not increase revision.
SELECT public.v2_commit_visual_override(:'workspace_a'::uuid,'routine',:'subject_routine_a'::uuid,
  0,2,'{"pose":"thumbs-up"}'::jsonb,'11111111-1111-4111-8111-111111111111'::uuid);
select set_config('request.jwt.claim.sub', :'member_b_uid', true);
DO $$ BEGIN
 IF not public.is_workspace_member(current_setting('hc.workspace_a')::uuid) THEN RAISE EXCEPTION 'Fixture B is not member'; END IF;
 IF (select overrides_json->>'pose' from public.visual_overrides where workspace_id=current_setting('hc.workspace_a')::uuid
      and subject_type='routine' and subject_id=current_setting('hc.subject_a')::uuid) <> 'thumbs-up'
    THEN RAISE EXCEPTION 'B cannot read A write'; END IF;
END $$;
-- B submits old revision: conflict object; row must remain untouched.
SELECT public.v2_commit_visual_override(:'workspace_a'::uuid,'routine',:'subject_routine_a'::uuid,
  0,2,'{"pose":"wave"}'::jsonb,'22222222-2222-4222-8222-222222222222'::uuid);
select set_config('request.jwt.claim.sub', :'outsider_uid', true);
DO $$ BEGIN
 IF exists(select 1 from public.visual_overrides where workspace_id=current_setting('hc.workspace_a')::uuid) THEN
   RAISE EXCEPTION 'RLS leak to outsider';
 END IF;
 BEGIN
  perform public.v2_commit_visual_override(current_setting('hc.workspace_a')::uuid,'routine',current_setting('hc.subject_a')::uuid,
    1,2,'{"pose":"wave"}'::jsonb,'33333333-3333-4333-8333-333333333333'::uuid);
  RAISE EXCEPTION 'Outsider unexpectedly wrote';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
select set_config('request.jwt.claim.sub', :'member_a_uid', true);
DO $$ BEGIN
 BEGIN
  perform public.v2_commit_visual_override(current_setting('hc.workspace_a')::uuid,'routine',current_setting('hc.subject_a')::uuid,
    1,2,'{"svg":"<svg onload=alert(1)>"}'::jsonb,'44444444-4444-4444-8444-444444444444'::uuid);
  RAISE EXCEPTION 'Unwhitelisted JSON unexpectedly accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- RLS policies and SQL transaction do not require a realtime channel.
ROLLBACK;
