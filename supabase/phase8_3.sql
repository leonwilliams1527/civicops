-- CivicOps Phase 8.3: notification center and email outbox (no external email delivery yet).
-- Run after Phase 8.2. Safe to rerun. Existing operational data is preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS public.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email_enabled boolean NOT NULL DEFAULT true,
 desktop_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid REFERENCES public.update_requests(id) ON DELETE CASCADE,
 event_type text NOT NULL,
 title text NOT NULL,
 body text NOT NULL DEFAULT '',
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(recipient_id,request_id,event_type,created_at)
);
CREATE INDEX IF NOT EXISTS civicops_notifications_user_idx ON public.notifications(recipient_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.notification_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 notification_id uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications,public.notification_preferences,public.notification_email_outbox FROM anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON public.notifications TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated;
DROP POLICY IF EXISTS civicops_notif_select ON public.notifications;
CREATE POLICY civicops_notif_select ON public.notifications FOR SELECT TO authenticated USING (recipient_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS civicops_notif_mark_read ON public.notifications;
CREATE POLICY civicops_notif_mark_read ON public.notifications FOR UPDATE TO authenticated USING (recipient_id=(SELECT auth.uid())) WITH CHECK (recipient_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS civicops_pref_select ON public.notification_preferences;
CREATE POLICY civicops_pref_select ON public.notification_preferences FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS civicops_pref_insert ON public.notification_preferences;
CREATE POLICY civicops_pref_insert ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS civicops_pref_update ON public.notification_preferences;
CREATE POLICY civicops_pref_update ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
-- Email outbox has NO client-side access. A future server-side Resend worker may use the service role.
CREATE OR REPLACE FUNCTION public.civicops_emit_notification(p_request_id uuid,p_department text,p_event text,p_title text,p_body text,p_actor uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 WITH created AS (
  INSERT INTO public.notifications(recipient_id,request_id,event_type,title,body)
  SELECT m.user_id,p_request_id,p_event,left(p_title,200),left(p_body,1500)
  FROM public.memberships m
  WHERE m.department=p_department AND (p_actor IS NULL OR m.user_id<>p_actor)
    AND EXISTS(SELECT 1 FROM public.update_requests r WHERE r.id=p_request_id AND (r.requesting_department=m.department OR r.assigned_department=m.department))
  RETURNING id,recipient_id
 )
 INSERT INTO public.notification_email_outbox(notification_id,recipient_id)
 SELECT c.id,c.recipient_id FROM created c
 WHERE coalesce((SELECT email_enabled FROM public.notification_preferences WHERE user_id=c.recipient_id),true);
END; $$;
REVOKE ALL ON FUNCTION public.civicops_emit_notification(uuid,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.civicops_notify_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.civicops_emit_notification(NEW.id,NEW.assigned_department,'assignment','New request assigned',NEW.project_id||' · '||NEW.title,NEW.created_by);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_notify_request_created ON public.update_requests;
CREATE TRIGGER civicops_notify_request_created AFTER INSERT ON public.update_requests FOR EACH ROW EXECUTE FUNCTION public.civicops_notify_request_created();
CREATE OR REPLACE FUNCTION public.civicops_notify_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.update_requests%ROWTYPE; target text; event_title text;
BEGIN
 SELECT * INTO req FROM public.update_requests WHERE id=NEW.request_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 target:=CASE WHEN NEW.actor_department=req.requesting_department THEN req.assigned_department ELSE req.requesting_department END;
 event_title:=CASE WHEN NEW.event_type='status_change' THEN 'Request status changed' ELSE 'New request update' END;
 PERFORM public.civicops_emit_notification(req.id,target,NEW.event_type,event_title,req.project_id||' · '||req.title||' · '||left(NEW.body,350),NEW.actor_id);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_notify_activity ON public.request_activity;
CREATE TRIGGER civicops_notify_activity AFTER INSERT ON public.request_activity FOR EACH ROW EXECUTE FUNCTION public.civicops_notify_activity();
CREATE OR REPLACE FUNCTION public.civicops_notify_attachment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.update_requests%ROWTYPE; target text;
BEGIN
 IF NEW.request_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO req FROM public.update_requests WHERE id=NEW.request_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 target:=CASE WHEN NEW.department=req.requesting_department THEN req.assigned_department ELSE req.requesting_department END;
 PERFORM public.civicops_emit_notification(req.id,target,'attachment','New request attachment',req.project_id||' · '||left(NEW.original_name,150),NEW.uploaded_by);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_notify_attachment ON public.department_files;
CREATE TRIGGER civicops_notify_attachment AFTER INSERT ON public.department_files FOR EACH ROW EXECUTE FUNCTION public.civicops_notify_attachment();
COMMIT;
