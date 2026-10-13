-- PHASE 19B STAGING ONLY, NOT EXECUTED. All DML is rolled back.
-- Requires forward 19B migration and fixture members A/B active in workspace A.
-- Usage: psql "$STAGING_URL" -v ON_ERROR_STOP=1 \
--   -v workspace_a=UUID -v workspace_b=UUID -v scene_a=UUID \
--   -v member_a_uid=UUID -v member_b_uid=UUID -v outsider_uid=UUID \
--   -f supabase/staging/v2_phase19b_scene_rls.sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('hc.workspace_a', :'workspace_a', true);
SELECT set_config('hc.workspace_b', :'workspace_b', true);
SELECT set_config('hc.scene_a', :'scene_a', true);
SELECT set_config('request.jwt.claim.sub', :'member_a_uid', true);
DO $$ BEGIN
 IF NOT public.is_workspace_member(current_setting('hc.workspace_a')::uuid) THEN RAISE EXCEPTION 'Fixture A not a member'; END IF;
 IF EXISTS(SELECT 1 FROM public.scene_decorations WHERE workspace_id=current_setting('hc.workspace_b')::uuid) THEN RAISE EXCEPTION 'Cross-household scene data leaked'; END IF;
 BEGIN
   INSERT INTO public.scene_decorations(workspace_id,scene_id,generator_version,schema_version,items_json,revision,last_mutation_id)
   VALUES(current_setting('hc.workspace_a')::uuid,current_setting('hc.scene_a')::uuid,1,1,'[]',1,gen_random_uuid());
   RAISE EXCEPTION 'Direct insert incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.v2_commit_scene_decorations(:'workspace_a'::uuid,:'scene_a'::uuid,0,1,
  '[{"id":"sampleA","kind":"plant","ink":"teal","layer":"above","x":500,"y":350,"scale":1,"rotation":0}]'::jsonb,
  '11111111-1111-4111-8111-111111111111'::uuid);
-- Retry must be idempotent; revision stays 1.
SELECT public.v2_commit_scene_decorations(:'workspace_a'::uuid,:'scene_a'::uuid,0,1,
  '[{"id":"sampleA","kind":"plant","ink":"teal","layer":"above","x":500,"y":350,"scale":1,"rotation":0}]'::jsonb,
  '11111111-1111-4111-8111-111111111111'::uuid);
SELECT set_config('request.jwt.claim.sub', :'member_b_uid', true);
DO $$ BEGIN
 IF (SELECT revision FROM public.scene_decorations WHERE workspace_id=current_setting('hc.workspace_a')::uuid AND scene_id=current_setting('hc.scene_a')::uuid) <> 1 THEN RAISE EXCEPTION 'Member B cannot see saved revision'; END IF;
END $$;
-- A concurrent stale revision must return conflict, without overwriting.
SELECT public.v2_commit_scene_decorations(:'workspace_a'::uuid,:'scene_a'::uuid,0,1,'[]'::jsonb,
  '22222222-2222-4222-8222-222222222222'::uuid);
SELECT set_config('request.jwt.claim.sub', :'outsider_uid', true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.scene_decorations WHERE workspace_id=current_setting('hc.workspace_a')::uuid) THEN RAISE EXCEPTION 'Outsider can read scene'; END IF;
 BEGIN
   PERFORM public.v2_commit_scene_decorations(current_setting('hc.workspace_a')::uuid,current_setting('hc.scene_a')::uuid,1,1,'[]'::jsonb,gen_random_uuid());
   RAISE EXCEPTION 'Outsider wrote scene';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', :'member_a_uid', true);
DO $$ BEGIN
 BEGIN
  PERFORM public.v2_commit_scene_decorations(current_setting('hc.workspace_a')::uuid,current_setting('hc.scene_a')::uuid,1,1,
    '[{"id":"bad","kind":"plant","ink":"teal","layer":"above","x":50,"y":20,"scale":1,"rotation":0,"url":"https://evil.test"}]'::jsonb,gen_random_uuid());
  RAISE EXCEPTION 'Unsafe URL accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
ROLLBACK;
