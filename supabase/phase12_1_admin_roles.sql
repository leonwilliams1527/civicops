-- Phase 12.1: role management. Run after Phase 12. No data reset.
BEGIN;
-- Admins may list all membership records for role administration.
DROP POLICY IF EXISTS civicops_admin_membership_read ON public.memberships;
CREATE POLICY civicops_admin_membership_read ON public.memberships FOR SELECT TO authenticated USING (public.is_pilot_admin());
-- Names are displayed only when profile RLS allows them; no profile policy is weakened.
CREATE OR REPLACE FUNCTION public.civicops_set_member_role(p_user_id uuid,p_new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_previous text; v_department text;
BEGIN
 IF v_actor IS NULL OR NOT public.is_pilot_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_new_role IS NULL OR p_new_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF p_user_id=v_actor THEN RAISE EXCEPTION 'You cannot change your own admin role'; END IF;
 -- Serialize role mutations so concurrent requests cannot remove the last admin.
 PERFORM pg_catalog.pg_advisory_xact_lock(71324,1201);
 SELECT role,department INTO v_previous,v_department FROM public.memberships WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employee membership not found'; END IF;
 IF v_previous=p_new_role THEN RETURN; END IF;
 IF v_previous='admin' AND p_new_role='member' AND
    (SELECT count(*) FROM public.memberships WHERE role='admin') <= 1
 THEN RAISE EXCEPTION 'Cannot remove the last administrator'; END IF;
 UPDATE public.memberships SET role=p_new_role WHERE user_id=p_user_id;
 INSERT INTO public.civicops_audit_events(event_type,entity_type,entity_id,actor_id,department,details)
 VALUES('membership.role_changed','membership',p_user_id,v_actor,v_department,
 jsonb_build_object('old_role',v_previous,'new_role',p_new_role));
END; $$;
REVOKE ALL ON FUNCTION public.civicops_set_member_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civicops_set_member_role(uuid,text) TO authenticated;
COMMIT;
