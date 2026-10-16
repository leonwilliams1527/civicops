-- Phase 7.5: additive profile permissions fix. Run in CivicOps-Production.
BEGIN;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS designation text;
-- Validate designation length in the application; avoid duplicating constraints on repeat runs.
GRANT SELECT, INSERT ON public.user_profiles TO authenticated;
GRANT UPDATE (full_name, designation, updated_at) ON public.user_profiles TO authenticated;
-- Existing RLS restricts INSERT/UPDATE to the authenticated user's own user_id.
COMMIT;
