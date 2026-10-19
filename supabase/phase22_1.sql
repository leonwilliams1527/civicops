-- Phase 22.1 — employee invitations and scoped administration
BEGIN;
CREATE TABLE IF NOT EXISTS public.civicops_super_admins (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.civicops_super_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.civicops_super_admins FROM PUBLIC,anon,authenticated;
-- Bootstrap the known original CivicOps owner; verify UUID in Auth > Users before running.
INSERT INTO public.civicops_super_admins(user_id)
SELECT id FROM auth.users WHERE id='65838f61-5857-4d04-9ee9-3a0d68bc0ab1'
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.civicops_employee_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 full_name text NOT NULL,
 department text NOT NULL CHECK(department IN ('Water Quality','GIS','Permitting','Engineering','Project Management','Finance')),
 role text NOT NULL CHECK(role IN ('member','admin')),
 invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_at timestamptz,
 revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS civicops_one_active_invite_per_email
 ON public.civicops_employee_invitations(lower(email)) WHERE status='pending';
ALTER TABLE public.civicops_employee_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.civicops_employee_invitations FROM PUBLIC,anon,authenticated;
-- The server uses service-role access. Never expose the invitation list to ordinary members.
-- Replace the old global-admin role-changing RPC with a scoped, audited version.
CREATE OR REPLACE FUNCTION public.civicops_set_member_role(p_user_id uuid,p_new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); actor_dept text; target_dept text;
DECLARE previous_role text; super_admin boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_new_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF p_user_id=actor THEN RAISE EXCEPTION 'Cannot change own role'; END IF;
 SELECT department INTO actor_dept FROM public.memberships WHERE user_id=actor AND role='admin';
 IF actor_dept IS NULL THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.civicops_super_admins WHERE user_id=actor) INTO super_admin;
 SELECT department,role INTO target_dept,previous_role FROM public.memberships WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
 IF NOT super_admin THEN
   RAISE EXCEPTION 'Only Super Admin can change administrator roles' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(71324,1201);
 IF previous_role='admin' AND p_new_role='member'
 AND (SELECT count(*) FROM public.memberships WHERE role='admin')<=1 THEN
   RAISE EXCEPTION 'Cannot remove last administrator';
 END IF;
 IF EXISTS(SELECT 1 FROM public.civicops_super_admins WHERE user_id=p_user_id)
 AND p_new_role<>'admin' THEN RAISE EXCEPTION 'Cannot demote a Super Admin'; END IF;
 IF previous_role=p_new_role THEN RETURN; END IF;
 UPDATE public.memberships SET role=p_new_role WHERE user_id=p_user_id;
 INSERT INTO public.civicops_audit_events(event_type,entity_type,entity_id,actor_id,department,details)
 VALUES('membership.role_changed','membership',p_user_id,actor,target_dept,
 jsonb_build_object('old_role',previous_role,'new_role',p_new_role));
END; $$;
REVOKE ALL ON FUNCTION public.civicops_set_member_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civicops_set_member_role(uuid,text) TO authenticated;
COMMIT;
