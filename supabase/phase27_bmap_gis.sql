-- CivicOps Phase 27: run once in Supabase SQL Editor before opening BMAP & GIS.
-- This creates separate location metadata; no existing spreadsheet or request records are modified.
create table if not exists public.bmap_project_locations (
 project_record_id uuid primary key references public.spreadsheet_projects(id) on delete cascade,
 latitude double precision not null check (latitude between 24 and 32),
 longitude double precision not null check (longitude between -88 and -79),
 location_label text,
 notes text,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.bmap_monitoring_stations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 160),
 department text not null,
 watershed text,
 latitude double precision not null check (latitude between 24 and 32),
 longitude double precision not null check (longitude between -88 and -79),
 notes text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.bmap_project_locations enable row level security;
alter table public.bmap_monitoring_stations enable row level security;
-- Project visibility inherits the project's existing row-level access rules.
drop policy if exists bmap_project_location_read on public.bmap_project_locations;
create policy bmap_project_location_read on public.bmap_project_locations for select to authenticated
 using (exists(select 1 from public.spreadsheet_projects p where p.id=project_record_id));
drop policy if exists bmap_project_location_insert on public.bmap_project_locations;
create policy bmap_project_location_insert on public.bmap_project_locations for insert to authenticated
 with check(updated_by=auth.uid() and exists(select 1 from public.memberships m where m.user_id=auth.uid() and (m.role='admin' or m.department='GIS')) and exists(select 1 from public.spreadsheet_projects p where p.id=project_record_id));
drop policy if exists bmap_project_location_update on public.bmap_project_locations;
create policy bmap_project_location_update on public.bmap_project_locations for update to authenticated
 using (exists(select 1 from public.memberships m where m.user_id=auth.uid() and (m.role='admin' or m.department='GIS')) and exists(select 1 from public.spreadsheet_projects p where p.id=project_record_id))
 with check(updated_by=auth.uid() and exists(select 1 from public.memberships m where m.user_id=auth.uid() and (m.role='admin' or m.department='GIS')) and exists(select 1 from public.spreadsheet_projects p where p.id=project_record_id));
drop policy if exists bmap_stations_read on public.bmap_monitoring_stations;
create policy bmap_stations_read on public.bmap_monitoring_stations for select to authenticated
 using (exists(select 1 from public.memberships m where m.user_id=auth.uid() and (m.role='admin' or m.department= bmap_monitoring_stations.department or m.department='GIS' or m.department='Water Quality')));
drop policy if exists bmap_stations_insert on public.bmap_monitoring_stations;
create policy bmap_stations_insert on public.bmap_monitoring_stations for insert to authenticated
 with check(created_by=auth.uid() and exists(select 1 from public.memberships m where m.user_id=auth.uid() and (m.role='admin' or m.department='GIS')));
-- No DELETE policies: accidental deletion is not permitted through client access.
