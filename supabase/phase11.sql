-- CivicOps Phase 11. Run after Phase 10. No existing records are deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.spreadsheet_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 department text NOT NULL,
 uploaded_by uuid NOT NULL REFERENCES auth.users(id),
 original_name text NOT NULL,
 row_count integer NOT NULL CHECK (row_count BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.spreadsheet_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 import_id uuid NOT NULL REFERENCES public.spreadsheet_imports(id) ON DELETE CASCADE,
 department text NOT NULL,
 project_id text NOT NULL,
 project_name text NOT NULL,
 watershed text,
 project_type text,
 status text,
 priority text,
 target_date date,
 estimated_cost numeric(16,2),
 progress_percent numeric(5,2),
 responsible_team text,
 latest_update text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(import_id,project_id),
 CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
 CHECK (estimated_cost IS NULL OR estimated_cost >= 0)
);
CREATE INDEX IF NOT EXISTS idx_civicops_spreadsheet_projects_department ON public.spreadsheet_projects(department);
CREATE INDEX IF NOT EXISTS idx_civicops_spreadsheet_projects_import ON public.spreadsheet_projects(import_id);
ALTER TABLE public.spreadsheet_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.spreadsheet_imports TO authenticated;
GRANT SELECT,INSERT ON public.spreadsheet_projects TO authenticated;
DROP POLICY IF EXISTS civicops_imports_read ON public.spreadsheet_imports;
CREATE POLICY civicops_imports_read ON public.spreadsheet_imports FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.department=spreadsheet_imports.department)
);
DROP POLICY IF EXISTS civicops_imports_write ON public.spreadsheet_imports;
CREATE POLICY civicops_imports_write ON public.spreadsheet_imports FOR INSERT TO authenticated WITH CHECK (
 uploaded_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.department=spreadsheet_imports.department)
);
DROP POLICY IF EXISTS civicops_projects_read ON public.spreadsheet_projects;
CREATE POLICY civicops_projects_read ON public.spreadsheet_projects FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.department=spreadsheet_projects.department)
);
DROP POLICY IF EXISTS civicops_projects_write ON public.spreadsheet_projects;
CREATE POLICY civicops_projects_write ON public.spreadsheet_projects FOR INSERT TO authenticated WITH CHECK (
 EXISTS (SELECT 1 FROM public.spreadsheet_imports i WHERE i.id=spreadsheet_projects.import_id AND i.department=spreadsheet_projects.department AND i.uploaded_by=(SELECT auth.uid()))
);
COMMIT;
