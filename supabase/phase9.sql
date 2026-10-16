-- CivicOps Phase 9: departmental task ownership and priority.
-- Requires Phase 7 tables. Can be run independently of the Phase 8.3 notification migration.
-- Safe to rerun; does not delete existing requests.
BEGIN;
ALTER TABLE public.update_requests ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Normal';
ALTER TABLE public.update_requests ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='civicops_request_priority_check' AND conrelid='public.update_requests'::regclass) THEN
  ALTER TABLE public.update_requests ADD CONSTRAINT civicops_request_priority_check CHECK(priority IN ('Low','Normal','High','Urgent'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS civicops_task_owner_idx ON public.update_requests(assigned_to,due_date);
CREATE INDEX IF NOT EXISTS civicops_task_priority_idx ON public.update_requests(priority,due_date);
-- Prevent assignments to people outside the request's assigned department.
CREATE OR REPLACE FUNCTION public.civicops_validate_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=NEW.assigned_to AND m.department=NEW.assigned_department
 ) THEN RAISE EXCEPTION 'Assigned employee must belong to the assigned department'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS civicops_validate_task_assignment ON public.update_requests;
CREATE TRIGGER civicops_validate_task_assignment BEFORE INSERT OR UPDATE OF assigned_to,assigned_department
ON public.update_requests FOR EACH ROW EXECUTE FUNCTION public.civicops_validate_task_assignment();
REVOKE UPDATE ON public.update_requests FROM authenticated;
GRANT UPDATE(status,priority,assigned_to) ON public.update_requests TO authenticated;
-- Existing request UPDATE RLS still controls which departments may modify a request.
-- Allow authenticated staff to see names/memberships of colleagues in their own department.
-- Do not expose other departments' member rosters.
DROP POLICY IF EXISTS "Read own membership" ON public.memberships;
CREATE POLICY "Read own membership" ON public.memberships FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR department=(SELECT public.my_department()));
COMMIT;
