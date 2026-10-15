-- CivicOps Phase 7.4: run ONCE in the EXISTING CivicOps-Production project.
-- Do not run in GYJobs. Does not remove users, requests, or history.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE(full_name) ON public.user_profiles TO authenticated;
DROP POLICY IF EXISTS "Authenticated users can read display names" ON public.user_profiles;
CREATE POLICY "Authenticated users can read display names" ON public.user_profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users create own profile" ON public.user_profiles;
CREATE POLICY "Users create own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users edit own name" ON public.user_profiles;
CREATE POLICY "Users edit own name" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

ALTER TABLE public.request_activity ADD COLUMN IF NOT EXISTS actor_department text;
ALTER TABLE public.request_activity ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'comment';
ALTER TABLE public.request_activity ADD COLUMN IF NOT EXISTS previous_status text;
ALTER TABLE public.request_activity ADD COLUMN IF NOT EXISTS new_status text;
UPDATE public.request_activity a SET actor_department=m.department
FROM public.memberships m WHERE a.actor_id=m.user_id AND a.actor_department IS NULL;
-- Previously written rows are backfilled from current membership where available;
-- they are NOT guaranteed to reflect historical department changes.

CREATE OR REPLACE FUNCTION public.stamp_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE dept text;
BEGIN
 SELECT department INTO dept FROM public.memberships WHERE user_id = auth.uid();
 IF dept IS NULL THEN RAISE EXCEPTION 'Department membership required'; END IF;
 IF NEW.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Actor must be signed-in user'; END IF;
 IF NEW.event_type = 'status_change' AND pg_trigger_depth() > 1 THEN
   NEW.actor_department := dept;
   RETURN NEW;
 END IF;
 IF NEW.event_type IS DISTINCT FROM 'comment' THEN RAISE EXCEPTION 'Status events are generated automatically'; END IF;
 NEW.actor_department := dept;
 NEW.previous_status := NULL;
 NEW.new_status := NULL;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_stamp_activity ON public.request_activity;
CREATE TRIGGER civicops_stamp_activity BEFORE INSERT ON public.request_activity
FOR EACH ROW EXECUTE FUNCTION public.stamp_activity();

CREATE OR REPLACE FUNCTION public.audit_request_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE dept text;
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  SELECT department INTO dept FROM public.memberships WHERE user_id=auth.uid();
  IF auth.uid() IS NULL OR dept IS NULL THEN RAISE EXCEPTION 'Authenticated department user required'; END IF;
  INSERT INTO public.request_activity(request_id,actor_id,actor_department,body,event_type,previous_status,new_status)
  VALUES (NEW.id,auth.uid(),dept,'Status changed from '||OLD.status||' to '||NEW.status,'status_change',OLD.status,NEW.status);
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS civicops_audit_request_status ON public.update_requests;
CREATE TRIGGER civicops_audit_request_status AFTER UPDATE OF status ON public.update_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_request_status();

-- Prevent clients from editing activity audit fields or deleting history.
REVOKE UPDATE, DELETE ON public.request_activity FROM authenticated;
COMMIT;
