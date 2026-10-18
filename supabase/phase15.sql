-- CivicOps Phase 15: authenticated requester, departmental ownership and assignment alerts.
-- Prerequisites: Phase 9 task fields and Phase 8.3 notification tables/triggers.
-- Non-destructive; preserves historical requests and existing assignments.
BEGIN;

-- The authenticated requester is the source of truth, not a client-submitted user ID.
CREATE OR REPLACE FUNCTION public.civicops_set_requester()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; v_department text;
BEGIN
 v_user := (SELECT auth.uid());
 IF v_user IS NOT NULL THEN
  SELECT m.department INTO v_department FROM public.memberships m WHERE m.user_id=v_user;
  IF v_department IS NULL THEN RAISE EXCEPTION 'Department membership required to create requests'; END IF;
  NEW.created_by := v_user;
  NEW.requesting_department := v_department;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_set_requester ON public.update_requests;
CREATE TRIGGER civicops_set_requester BEFORE INSERT ON public.update_requests
FOR EACH ROW EXECUTE FUNCTION public.civicops_set_requester();

-- Audit role changes and assignments separately; do not expose these records to clients.
CREATE TABLE IF NOT EXISTS public.civicops_assignment_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.update_requests(id) ON DELETE CASCADE,
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 previous_assignee uuid REFERENCES auth.users(id),
 new_assignee uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS civicops_assignment_audit_request_idx
ON public.civicops_assignment_audit(request_id,created_at DESC);
ALTER TABLE public.civicops_assignment_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.civicops_assignment_audit FROM PUBLIC,anon,authenticated;

-- Existing Phase 9 grants allowed any eligible receiving-team member to assign others.
-- Restrict ownership changes to this database-authorized RPC.
REVOKE UPDATE ON public.update_requests FROM authenticated;
REVOKE UPDATE(assigned_to) ON public.update_requests FROM authenticated;
GRANT UPDATE(status,priority) ON public.update_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.civicops_assign_request(p_request_id uuid,p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_department text; v_role text; v_request public.update_requests%ROWTYPE;
BEGIN
 v_actor := (SELECT auth.uid());
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT department,role INTO v_department,v_role FROM public.memberships WHERE user_id=v_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Department membership required'; END IF;
 SELECT * INTO v_request FROM public.update_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF v_request.assigned_department<>v_department THEN RAISE EXCEPTION 'Only the receiving department may assign this request'; END IF;
 IF v_request.status='Completed' THEN RAISE EXCEPTION 'Completed requests cannot be reassigned'; END IF;
 IF v_role<>'admin' AND NOT (v_request.assigned_to IS NULL AND p_employee_id=v_actor) THEN
  RAISE EXCEPTION 'Only receiving-department admins may reassign or unassign work';
 END IF;
 IF p_employee_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.memberships WHERE user_id=p_employee_id AND department=v_request.assigned_department
 ) THEN RAISE EXCEPTION 'Employee must belong to the receiving department'; END IF;
 IF v_request.assigned_to IS NOT DISTINCT FROM p_employee_id THEN RETURN; END IF;
 UPDATE public.update_requests SET assigned_to=p_employee_id WHERE id=p_request_id;
 INSERT INTO public.civicops_assignment_audit(request_id,changed_by,previous_assignee,new_assignee)
 VALUES (p_request_id,v_actor,v_request.assigned_to,p_employee_id);
END; $$;
REVOKE ALL ON FUNCTION public.civicops_assign_request(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civicops_assign_request(uuid,uuid) TO authenticated;

-- Notify the specific new owner, without broadcasting their personal assignment to everyone.
CREATE OR REPLACE FUNCTION public.civicops_notify_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_notification uuid;
BEGIN
 IF NEW.assigned_to IS NULL OR NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN RETURN NEW; END IF;
 INSERT INTO public.notifications(recipient_id,request_id,event_type,title,body)
 VALUES (NEW.assigned_to,NEW.id,'employee_assignment','New work assigned to you',left(NEW.project_id||' · '||NEW.title,1500))
 RETURNING id INTO v_notification;
 IF coalesce((SELECT email_enabled FROM public.notification_preferences WHERE user_id=NEW.assigned_to),true) THEN
  INSERT INTO public.notification_email_outbox(notification_id,recipient_id) VALUES(v_notification,NEW.assigned_to);
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_notify_assignee ON public.update_requests;
CREATE TRIGGER civicops_notify_assignee AFTER UPDATE OF assigned_to ON public.update_requests
FOR EACH ROW EXECUTE FUNCTION public.civicops_notify_assignee();

-- This function is trigger-only; no client execution is needed.
REVOKE ALL ON FUNCTION public.civicops_notify_assignee() FROM PUBLIC,anon,authenticated;
COMMIT;
