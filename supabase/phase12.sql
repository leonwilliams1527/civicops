-- CivicOps Phase 12: additive pilot audit and administrative visibility.
-- Run after Phase 11. No existing tables are dropped or rewritten.
BEGIN;
CREATE TABLE IF NOT EXISTS public.civicops_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_type text NOT NULL,
 entity_type text NOT NULL,
 entity_id uuid NOT NULL,
 actor_id uuid,
 department text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS civicops_audit_events_created_idx ON public.civicops_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS civicops_audit_events_department_idx ON public.civicops_audit_events(department,created_at DESC);
ALTER TABLE public.civicops_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.civicops_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.civicops_audit_events TO authenticated;
DROP POLICY IF EXISTS civicops_audit_admin_read ON public.civicops_audit_events;
CREATE POLICY civicops_audit_admin_read ON public.civicops_audit_events FOR SELECT TO authenticated USING (public.is_pilot_admin());
CREATE OR REPLACE FUNCTION public.civicops_audit_request_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.civicops_audit_events(event_type,entity_type,entity_id,actor_id,department,details)
  VALUES ('request.created','request',NEW.id,auth.uid(),NEW.assigned_department,jsonb_build_object('status',NEW.status,'project_id',NEW.project_id));
 ELSIF OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR OLD.priority IS DISTINCT FROM NEW.priority OR OLD.due_date IS DISTINCT FROM NEW.due_date THEN
  INSERT INTO public.civicops_audit_events(event_type,entity_type,entity_id,actor_id,department,details)
  VALUES ('request.updated','request',NEW.id,auth.uid(),NEW.assigned_department,jsonb_build_object('old_status',OLD.status,'new_status',NEW.status,'old_due_date',OLD.due_date,'new_due_date',NEW.due_date,'old_priority',OLD.priority,'new_priority',NEW.priority,'old_assignee',OLD.assigned_to,'new_assignee',NEW.assigned_to));
 END IF;
 RETURN NEW;
END; $$;
-- Phase 9 supplies assigned_to and priority. Fail explicitly if Phase 9 was not installed.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='update_requests' AND column_name='assigned_to')
 OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='update_requests' AND column_name='priority')
 THEN RAISE EXCEPTION 'Phase 9 task fields are missing; install Phase 9 before Phase 12'; END IF;
END $$;
DROP TRIGGER IF EXISTS civicops_phase12_request_audit ON public.update_requests;
CREATE TRIGGER civicops_phase12_request_audit AFTER INSERT OR UPDATE ON public.update_requests FOR EACH ROW EXECUTE FUNCTION public.civicops_audit_request_change();
CREATE OR REPLACE FUNCTION public.civicops_audit_import() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.civicops_audit_events(event_type,entity_type,entity_id,actor_id,department,details)
 VALUES ('spreadsheet.imported','spreadsheet_import',NEW.id,NEW.uploaded_by,NEW.department,jsonb_build_object('filename',NEW.original_name,'row_count',NEW.row_count));
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_phase12_import_audit ON public.spreadsheet_imports;
CREATE TRIGGER civicops_phase12_import_audit AFTER INSERT ON public.spreadsheet_imports FOR EACH ROW EXECUTE FUNCTION public.civicops_audit_import();
COMMIT;
