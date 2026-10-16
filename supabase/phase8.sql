-- CivicOps Phase 8: PRIVATE departmental documents and request attachments.
-- Run once in CivicOps-Production SQL Editor. Existing requests and profiles are unchanged.
create table if not exists public.department_files (
 id uuid primary key default gen_random_uuid(),
 storage_path text not null unique,
 original_name text not null,
 file_size bigint not null check(file_size>0 and file_size<=10485760),
 content_type text,
 department text not null,
 request_id uuid references public.update_requests(id) on delete set null,
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists department_files_dept_idx on public.department_files(department,created_at desc);
create index if not exists department_files_request_idx on public.department_files(request_id);
alter table public.department_files enable row level security;
grant select,insert on public.department_files to authenticated;

-- A participating department can read request attachments; only own department sees department-only files.
drop policy if exists "department_files_read" on public.department_files;
create policy "department_files_read" on public.department_files for select to authenticated using (
 exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and (
 (request_id is null and m.department=department) or
 (request_id is not null and exists(select 1 from public.update_requests r where r.id=request_id and m.department in (r.requesting_department,r.assigned_department)))
 ))
);
drop policy if exists "department_files_insert" on public.department_files;
create policy "department_files_insert" on public.department_files for insert to authenticated with check (
 uploaded_by=(select auth.uid()) and
 storage_path like (select auth.uid())::text || '/%' and
 exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.department=department and (
 request_id is null or exists(select 1 from public.update_requests r where r.id=request_id and m.department in (r.requesting_department,r.assigned_department)))
 ))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('department-files','department-files',false,10485760,null)
on conflict(id) do update set public=false,file_size_limit=10485760;

-- Storage uploads go into the uploader's own UUID folder. Never permit public read.
drop policy if exists "civicops_file_upload" on storage.objects;
create policy "civicops_file_upload" on storage.objects for insert to authenticated with check (
 bucket_id='department-files' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.memberships m where m.user_id=(select auth.uid()))
);
drop policy if exists "civicops_file_read" on storage.objects;
create policy "civicops_file_read" on storage.objects for select to authenticated using (
 bucket_id='department-files' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.department_files f where f.storage_path=name)
 )
);
-- Note: storage read policy above relies on department_files RLS for shared files.
-- No storage delete/update grants are added; file removal/versioning is deferred to QA.
