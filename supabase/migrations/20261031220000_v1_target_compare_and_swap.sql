-- V1 recovery: atomically replace ONE routine's targets with optimistic conflict detection.
-- Do not use to restore missing targets until the compatible client is deployed.
BEGIN;

-- Old clients must not directly delete target rows. RPC explicitly marks its transaction.
CREATE OR REPLACE FUNCTION public.v1_guard_last_routine_target()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_setting('app.v1_target_rpc', true) IS DISTINCT FROM 'allow' THEN
    RAISE EXCEPTION 'Routine targets can only be changed using the version-checked API'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.v1_replace_routine_targets(
  p_workspace_id uuid,
  p_routine_id uuid,
  p_expected jsonb,
  p_desired jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actual jsonb;
  expected_canonical jsonb;
  desired_canonical jsonb;
  bad_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id AND m.user_id = auth.uid()
      AND m.status = 'active' AND m.role IN ('owner','admin','member')
  ) THEN
    RAISE EXCEPTION 'Not authorized to change targets' USING ERRCODE = '42501';
  END IF;
  -- Lock the parent routine, serializing concurrent target changes.
  PERFORM 1 FROM public.routines r
  WHERE r.id = p_routine_id AND r.workspace_id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Routine not found in workspace' USING ERRCODE='23503'; END IF;
  IF jsonb_typeof(p_expected) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_desired) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Target snapshots must be arrays' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_desired) e
    WHERE jsonb_typeof(e) <> 'object'
      OR NOT (e ? 'entity_id') OR NOT (e ? 'include_descendants')
      OR jsonb_typeof(e->'include_descendants') <> 'boolean'
      OR (e->>'entity_id') !~ '^[0-9a-fA-F-]{36}$') THEN
    RAISE EXCEPTION 'Invalid target payload' USING ERRCODE='22023';
  END IF;
  SELECT count(*) INTO bad_count FROM jsonb_array_elements(p_desired) d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.entities e
    WHERE e.id::text = d->>'entity_id' AND e.workspace_id = p_workspace_id
  );
  IF bad_count > 0 THEN RAISE EXCEPTION 'Target belongs to another workspace or does not exist' USING ERRCODE='23503'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('entity_id', entity_id,'include_descendants',include_descendants)
    ORDER BY entity_id), '[]'::jsonb)
  INTO actual FROM public.routine_targets WHERE routine_id=p_routine_id AND workspace_id=p_workspace_id;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'entity_id'),'[]'::jsonb) INTO expected_canonical
    FROM jsonb_array_elements(p_expected) x;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'entity_id'),'[]'::jsonb) INTO desired_canonical
    FROM jsonb_array_elements(p_desired) x;
  IF actual <> expected_canonical THEN
    RAISE EXCEPTION 'Routine targets changed since load; reload before saving'
      USING ERRCODE='40001';
  END IF;
  IF jsonb_array_length(desired_canonical)=0 AND jsonb_array_length(actual)>0 THEN
    RAISE EXCEPTION 'Refusing to clear all targets via regular save'
      USING ERRCODE='23514';
  END IF;
  PERFORM set_config('app.v1_target_rpc','allow', true);
  DELETE FROM public.routine_targets WHERE routine_id=p_routine_id AND workspace_id=p_workspace_id;
  INSERT INTO public.routine_targets(workspace_id,routine_id,entity_id,include_descendants)
  SELECT p_workspace_id,p_routine_id,(x->>'entity_id')::uuid,(x->>'include_descendants')::boolean
  FROM jsonb_array_elements(desired_canonical) x;
  PERFORM set_config('app.v1_target_rpc','', true);
END;
$$;
REVOKE ALL ON FUNCTION public.v1_replace_routine_targets(uuid,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v1_replace_routine_targets(uuid,uuid,jsonb,jsonb) TO authenticated;
COMMIT;
