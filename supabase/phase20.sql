-- Phase 20: Project milestones, departmental ownership, audit trail.
-- Run once in Supabase SQL Editor AFTER prior phases.
BEGIN;
CREATE TABLE IF NOT EXISTS public.project_milestones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_row_id uuid NOT NULL REFERENCES public.spreadsheet_projects(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
 description text NOT NULL DEFAULT '',
 owner_department text NOT NULL,
 owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 due_date date NOT NULL,
 status text NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Blocked','Completed')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CONSTRAINT milestone_owner_dept_nonempty CHECK (length(trim(owner_department))>0)
);
CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON public.project_milestones(project_row_id,due_date);
CREATE TABLE IF NOT EXISTS public.project_milestone_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 milestone_id uuid NOT NULL REFERENCES public.project_milestones(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL,
 old_value jsonb,
 new_value jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_milestone_audit_idx ON public.project_milestone_audit(milestone_id,created_at DESC);
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestone_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_milestones,public.project_milestone_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_milestones,public.project_milestone_audit TO authenticated;
-- Read only where project is accessible under existing spreadsheet_projects RLS.
DROP POLICY IF EXISTS milestone_read ON public.project_milestones;
CREATE POLICY milestone_read ON public.project_milestones FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.spreadsheet_projects p WHERE p.id=project_row_id)
);
DROP POLICY IF EXISTS milestone_audit_read ON public.project_milestone_audit;
CREATE POLICY milestone_audit_read ON public.project_milestone_audit FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.project_milestones m WHERE m.id=milestone_id)
);
-- All writes through RPC; permissions validated against live memberships, not client input.
CREATE OR REPLACE FUNCTION public.civicops_milestone_save(
 p_id uuid,p_project_row_id uuid,p_title text,p_description text,p_department text,
 p_owner uuid,p_due date,p_status text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); actor_department text; actor_role text; lead_department text; old_row public.project_milestones%ROWTYPE; new_row public.project_milestones%ROWTYPE; result_id uuid;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT department,role INTO actor_department,actor_role FROM public.memberships WHERE user_id=a;
 IF actor_department IS NULL THEN RAISE EXCEPTION 'Department membership required'; END IF;
 IF p_status NOT IN ('Not Started','In Progress','Blocked','Completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF p_due IS NULL OR length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Title and due date required'; END IF;
 SELECT department INTO lead_department FROM public.spreadsheet_projects WHERE id=p_project_row_id;
 IF lead_department IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
 IF p_department IS NULL OR NOT EXISTS (SELECT 1 FROM public.memberships WHERE department=p_department) THEN RAISE EXCEPTION 'Choose a department with active members'; END IF;
 IF p_owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.memberships WHERE user_id=p_owner AND department=p_department) THEN RAISE EXCEPTION 'Employee must belong to milestone department'; END IF;
 IF p_id IS NULL THEN
  IF actor_role<>'admin' OR actor_department<>lead_department THEN RAISE EXCEPTION 'Only the project lead department admin may create milestones'; END IF;
  INSERT INTO public.project_milestones(project_row_id,title,description,owner_department,owner_user_id,due_date,status,created_by,completed_at)
  VALUES(p_project_row_id,trim(p_title),coalesce(p_description,''),p_department,p_owner,p_due,p_status,a,CASE WHEN p_status='Completed' THEN now() END)
  RETURNING * INTO new_row;
  result_id:=new_row.id;
  INSERT INTO public.project_milestone_audit(milestone_id,actor_id,action,new_value) VALUES(result_id,a,'created',to_jsonb(new_row));
 ELSE
  SELECT * INTO old_row FROM public.project_milestones WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR old_row.project_row_id<>p_project_row_id THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  IF actor_role<>'admin' OR (actor_department<>lead_department AND actor_department<>old_row.owner_department) THEN RAISE EXCEPTION 'Only a lead or owning department admin may edit milestones'; END IF;
  IF actor_department<>lead_department AND (p_department<>old_row.owner_department OR p_title<>old_row.title OR coalesce(p_description,'')<>old_row.description OR p_due<>old_row.due_date) THEN
    RAISE EXCEPTION 'Only the lead department admin may change milestone scope or department';
  END IF;
  UPDATE public.project_milestones SET title=trim(p_title),description=coalesce(p_description,''),owner_department=p_department,owner_user_id=p_owner,due_date=p_due,status=p_status,updated_at=now(),completed_at=CASE WHEN p_status='Completed' THEN coalesce(old_row.completed_at,now()) ELSE NULL END WHERE id=p_id RETURNING * INTO new_row;
  result_id:=p_id;
  IF to_jsonb(old_row) IS DISTINCT FROM to_jsonb(new_row) THEN
   INSERT INTO public.project_milestone_audit(milestone_id,actor_id,action,old_value,new_value) VALUES(result_id,a,'updated',to_jsonb(old_row),to_jsonb(new_row));
  END IF;
 END IF;
 RETURN result_id;
END; $$;
REVOKE ALL ON FUNCTION public.civicops_milestone_save(uuid,uuid,text,text,text,uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civicops_milestone_save(uuid,uuid,text,text,text,uuid,date,text) TO authenticated;
COMMIT;
