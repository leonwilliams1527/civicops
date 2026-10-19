-- CivicOps Phase 20.1: milestone-based, department-scoped project sharing.
-- Run AFTER phase20.sql. Existing imports and original project ownership remain unchanged.
BEGIN;
-- SECURITY DEFINER bypasses milestone RLS to avoid circular project/milestone policy evaluation.
-- Access is derived from the caller's verified department and a milestone assigned to it.
CREATE OR REPLACE FUNCTION public.civicops_can_view_shared_project(p_project_row_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.project_milestones pm
  JOIN public.memberships mem ON mem.department=pm.owner_department
  WHERE pm.project_row_id=p_project_row_id AND mem.user_id=(SELECT auth.uid())
 );
$$;
REVOKE ALL ON FUNCTION public.civicops_can_view_shared_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.civicops_can_view_shared_project(uuid) TO authenticated;
-- Preserve lead-department access; additionally permit departments explicitly owning a milestone.
DROP POLICY IF EXISTS civicops_projects_read ON public.spreadsheet_projects;
CREATE POLICY civicops_projects_read ON public.spreadsheet_projects FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.memberships mem WHERE mem.user_id=(SELECT auth.uid()) AND mem.department=spreadsheet_projects.department)
 OR (SELECT public.civicops_can_view_shared_project(spreadsheet_projects.id))
);
-- Project visibility now flows through existing Phase 20 milestone/audit SELECT policies.
-- Spreadsheet imports are intentionally NOT shared; their RLS stays department-only.
COMMIT;
