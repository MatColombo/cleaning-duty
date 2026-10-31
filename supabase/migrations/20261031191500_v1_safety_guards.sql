-- V1 safety guards. Run after backing up database. No historical rows are changed.
-- This is intentionally conservative: it rejects deletion of the last remaining
-- target in a workspace that still has active targeted routines.
BEGIN;

CREATE OR REPLACE FUNCTION public.v1_guard_last_routine_target()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  remaining_count integer;
  active_count integer;
BEGIN
  -- Serialize target deletions for the workspace to prevent concurrent races.
  PERFORM 1 FROM public.workspaces WHERE id = OLD.workspace_id FOR UPDATE;
  SELECT count(*) INTO remaining_count
  FROM public.routine_targets WHERE workspace_id = OLD.workspace_id;
  SELECT count(*) INTO active_count
  FROM public.routines WHERE workspace_id = OLD.workspace_id
    AND status = 'active' AND archived_at IS NULL
    AND (recurrence->>'kind') IS DISTINCT FROM 'once';
  IF remaining_count <= 1 AND active_count > 0 THEN
    RAISE EXCEPTION 'V1 safety guard: refusing to remove the last routine target of a workspace with active routines (%).', OLD.workspace_id
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS v1_guard_last_routine_target ON public.routine_targets;
CREATE TRIGGER v1_guard_last_routine_target
BEFORE DELETE ON public.routine_targets FOR EACH ROW
EXECUTE FUNCTION public.v1_guard_last_routine_target();

-- Detect corrupt or reversed trajectory intervals at the database boundary.
-- Existing data remain untouched.
ALTER TABLE public.health_trajectories
  DROP CONSTRAINT IF EXISTS v1_health_anchor_before_due;
ALTER TABLE public.health_trajectories
  ADD CONSTRAINT v1_health_anchor_before_due
  CHECK (health_due_at > health_anchor_at) NOT VALID;

-- Secondary/linked activities cannot create new autonomous trajectories.
-- Historical trajectories remain available for audit; the application patch
-- excludes them from Regular/Deep aggregation.
CREATE OR REPLACE FUNCTION public.v1_reject_secondary_trajectory_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.routines r
    WHERE r.id = NEW.routine_id AND r.workspace_id = NEW.workspace_id
      AND r.parent_routine_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Linked routine cannot write independent cleanliness trajectory (%)', NEW.routine_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS v1_reject_secondary_trajectory_write ON public.health_trajectories;
CREATE TRIGGER v1_reject_secondary_trajectory_write
BEFORE INSERT OR UPDATE ON public.health_trajectories FOR EACH ROW
EXECUTE FUNCTION public.v1_reject_secondary_trajectory_write();

COMMIT;
