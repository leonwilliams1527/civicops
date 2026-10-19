-- CivicOps Phase 22: milestone reminders, escalation, and assignment alerts.
-- Run after phases 20, 20.1, and 13. No existing project data is deleted.
BEGIN;
ALTER TABLE public.notifications
 ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS civicops_notification_milestone_idx ON public.notifications(milestone_id);
CREATE TABLE IF NOT EXISTS public.milestone_reminder_log (
 milestone_id uuid NOT NULL REFERENCES public.project_milestones(id) ON DELETE CASCADE,
 reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon','overdue','escalation')),
 reminder_date date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(milestone_id,reminder_type,reminder_date)
);
ALTER TABLE public.milestone_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.milestone_reminder_log FROM PUBLIC,anon,authenticated;
-- A changed owner receives an in-app alert immediately. Avoid sending to the actor.
CREATE OR REPLACE FUNCTION public.civicops_milestone_assignment_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); nid uuid;
BEGIN
 IF NEW.owner_user_id IS NOT NULL
    AND (TG_OP='INSERT' OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id) THEN
  INSERT INTO public.notifications(recipient_id,milestone_id,event_type,title,body)
  VALUES(NEW.owner_user_id,NEW.id,'milestone_assignment','Milestone assigned',
         left(NEW.title||' · Due '||NEW.due_date::text,1500))
  RETURNING id INTO nid;
  IF coalesce((SELECT email_enabled FROM public.notification_preferences WHERE user_id=NEW.owner_user_id),true) THEN
   INSERT INTO public.notification_email_outbox(notification_id,recipient_id)
   VALUES(nid,NEW.owner_user_id) ON CONFLICT (notification_id) DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_milestone_assignment_alert ON public.project_milestones;
CREATE TRIGGER civicops_milestone_assignment_alert
 AFTER INSERT OR UPDATE OF owner_user_id ON public.project_milestones
 FOR EACH ROW EXECUTE FUNCTION public.civicops_milestone_assignment_alert();

-- Idempotent daily reminders; notify assigned owner, or owning department admins
-- when unassigned. Escalations also reach lead department admins.
CREATE OR REPLACE FUNCTION public.civicops_process_milestone_deadlines(p_today date DEFAULT CURRENT_DATE)
RETURNS TABLE(milestones_processed integer, notifications_created integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rec record; kind text; new_log integer; recipient uuid; nid uuid;
DECLARE processed integer:=0; sent integer:=0;
BEGIN
 IF p_today IS NULL THEN RAISE EXCEPTION 'Date required'; END IF;
 FOR rec IN
  SELECT m.id,m.title,m.due_date,m.owner_department,m.owner_user_id,
         p.department AS lead_department
  FROM public.project_milestones m
  JOIN public.spreadsheet_projects p ON p.id=m.project_row_id
  WHERE m.status<>'Completed' AND m.due_date<=p_today+3
 LOOP
  kind:=CASE WHEN rec.due_date<=p_today-3 THEN 'escalation'
             WHEN rec.due_date<p_today THEN 'overdue' ELSE 'due_soon' END;
  INSERT INTO public.milestone_reminder_log(milestone_id,reminder_type,reminder_date)
  VALUES(rec.id,kind,p_today) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS new_log=ROW_COUNT;
  IF new_log=0 THEN CONTINUE; END IF;
  processed:=processed+1;
  FOR recipient IN
   SELECT DISTINCT user_id FROM public.memberships
   WHERE (user_id=rec.owner_user_id)
      OR (rec.owner_user_id IS NULL AND department=rec.owner_department AND role='admin')
      OR (kind='escalation' AND department=rec.lead_department AND role='admin')
  LOOP
   INSERT INTO public.notifications(recipient_id,milestone_id,event_type,title,body)
   VALUES(recipient,rec.id,'milestone_'||kind,
          CASE kind WHEN 'due_soon' THEN 'Milestone due soon'
                    WHEN 'overdue' THEN 'Milestone overdue'
                    ELSE 'Escalation: overdue milestone' END,
          left(rec.title||' · '||rec.owner_department||' · Due '||rec.due_date::text,1500))
   RETURNING id INTO nid;
   sent:=sent+1;
   IF coalesce((SELECT email_enabled FROM public.notification_preferences WHERE user_id=recipient),true) THEN
    INSERT INTO public.notification_email_outbox(notification_id,recipient_id)
    VALUES(nid,recipient) ON CONFLICT (notification_id) DO NOTHING;
   END IF;
  END LOOP;
 END LOOP;
 RETURN QUERY SELECT processed,sent;
END; $$;
REVOKE ALL ON FUNCTION public.civicops_process_milestone_deadlines(date)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.civicops_process_milestone_deadlines(date) TO service_role;
COMMIT;
