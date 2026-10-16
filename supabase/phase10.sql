-- CivicOps Phase 10: due-date reminders and escalation queue.
-- Prerequisites: Phase 9 task fields and successfully installed Phase 8.3 notification tables.
-- Does not send email; the existing outbox is reserved for a later Resend worker.
-- Run the full script in Supabase SQL Editor.
BEGIN;
CREATE TABLE IF NOT EXISTS public.request_reminder_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.update_requests(id) ON DELETE CASCADE,
 reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon','overdue','escalation')),
 reminder_date date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,reminder_type,reminder_date)
);
ALTER TABLE public.request_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_reminder_log FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS civicops_reminder_date_idx ON public.request_reminder_log(reminder_date);
-- Runs with trusted database privileges only. Not executable by authenticated users.
CREATE OR REPLACE FUNCTION public.civicops_process_deadlines(p_today date DEFAULT CURRENT_DATE)
RETURNS TABLE(requests_processed integer, notifications_created integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rec record; kind text; target_department text; inserted_count integer:=0; request_count integer:=0; n integer;
BEGIN
 IF p_today IS NULL THEN RAISE EXCEPTION 'Date required'; END IF;
 FOR rec IN
   SELECT r.id,r.project_id,r.title,r.due_date,r.priority,r.assigned_department,r.requesting_department,r.assigned_to
   FROM public.update_requests r
   WHERE r.status<>'Completed' AND r.due_date IS NOT NULL
     AND r.due_date <= p_today+3
 LOOP
   kind:=CASE WHEN rec.due_date<p_today AND rec.due_date<=p_today-3 THEN 'escalation'
              WHEN rec.due_date<p_today THEN 'overdue' ELSE 'due_soon' END;
   -- One notification per request and category per day, even if worker retries.
   INSERT INTO public.request_reminder_log(request_id,reminder_type,reminder_date)
   VALUES(rec.id,kind,p_today) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n=0 THEN CONTINUE; END IF;
   request_count:=request_count+1;
   -- Notify members of the assigned department; escalation also notifies requesting department.
   WITH recipients AS (
     SELECT DISTINCT m.user_id
     FROM public.memberships m
     WHERE m.department=rec.assigned_department
       OR (kind='escalation' AND m.department=rec.requesting_department)
   ), inserted AS (
     INSERT INTO public.notifications(recipient_id,request_id,event_type,title,body)
     SELECT user_id,rec.id,kind,
       CASE kind WHEN 'due_soon' THEN 'Request due soon' WHEN 'overdue' THEN 'Request overdue' ELSE 'Escalation: overdue request' END,
       left(rec.project_id||' · '||rec.title||' · Due '||rec.due_date::text,1500)
     FROM recipients RETURNING id,recipient_id
   ), queued AS (
     INSERT INTO public.notification_email_outbox(notification_id,recipient_id)
     SELECT i.id,i.recipient_id FROM inserted i
     WHERE coalesce((SELECT p.email_enabled FROM public.notification_preferences p WHERE p.user_id=i.recipient_id),true)
     RETURNING id
   ) SELECT count(*) INTO n FROM inserted;
   inserted_count:=inserted_count+n;
 END LOOP;
 RETURN QUERY SELECT request_count,inserted_count;
END; $$;
REVOKE ALL ON FUNCTION public.civicops_process_deadlines(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.civicops_process_deadlines(date) TO service_role;
COMMIT;
-- For a ONE-TIME test only, manually execute: SELECT * FROM public.civicops_process_deadlines(CURRENT_DATE);
-- For ongoing reminders, schedule the function once daily using Supabase Cron / pg_cron
-- after verifying recipient behavior and your production timezone. Do not enable blindly.
