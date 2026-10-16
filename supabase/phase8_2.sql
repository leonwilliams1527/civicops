-- CivicOps Phase 8.2 - profile photos. Run after the existing Phase 8 migration.
-- No existing request, membership, or document data is deleted.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_path text;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('profile-photos','profile-photos',false,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=3145728,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "civicops_avatar_upload" ON storage.objects;
CREATE POLICY "civicops_avatar_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='profile-photos' AND (storage.foldername(name))[1]=(select auth.uid())::text);
DROP POLICY IF EXISTS "civicops_avatar_read" ON storage.objects;
CREATE POLICY "civicops_avatar_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='profile-photos' AND EXISTS (SELECT 1 FROM public.memberships WHERE user_id=(select auth.uid())));
DROP POLICY IF EXISTS "civicops_avatar_delete" ON storage.objects;
CREATE POLICY "civicops_avatar_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='profile-photos' AND (storage.foldername(name))[1]=(select auth.uid())::text);
