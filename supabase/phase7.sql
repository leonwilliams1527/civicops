-- CivicOps Phase 7: run in Supabase SQL Editor. Pilot-only; do not upload sensitive City data.
create extension if not exists pgcrypto;
create table if not exists public.memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 department text not null check (department in ('Water Quality','GIS','Permitting','Engineering','Project Management','Finance')),
 role text not null default 'member' check(role in ('member','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.update_requests (
 id uuid primary key default gen_random_uuid(),
 project_id text not null,
 title text not null,
 requesting_department text not null,
 assigned_department text not null,
 created_by uuid not null references auth.users(id),
 owner_id uuid references auth.users(id),
 due_date date not null,
 details text not null default '',
 status text not null default 'Open' check(status in ('Open','In Progress','Completed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.request_activity (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.update_requests(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create or replace function public.my_department() returns text language sql stable security definer set search_path=public as $$ select department from public.memberships where user_id=auth.uid() $$;
create or replace function public.is_pilot_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.memberships where user_id=auth.uid() and role='admin') $$;
revoke all on function public.my_department() from public;
revoke all on function public.is_pilot_admin() from public;
grant execute on function public.my_department() to authenticated;
grant execute on function public.is_pilot_admin() to authenticated;
alter table public.memberships enable row level security;
alter table public.update_requests enable row level security;
alter table public.request_activity enable row level security;
create policy "Read own membership" on public.memberships for select to authenticated using (user_id=auth.uid());
create policy "Read department requests" on public.update_requests for select to authenticated using (public.is_pilot_admin() or requesting_department=public.my_department() or assigned_department=public.my_department());
create policy "Create requests from own department" on public.update_requests for insert to authenticated with check (created_by=auth.uid() and requesting_department=public.my_department() and status='Open' and owner_id is null);
create policy "Assigned team can update requests" on public.update_requests for update to authenticated using (public.is_pilot_admin() or assigned_department=public.my_department()) with check (public.is_pilot_admin() or assigned_department=public.my_department());
create policy "Read linked activity" on public.request_activity for select to authenticated using (exists(select 1 from public.update_requests r where r.id=request_id));
create policy "Post linked activity" on public.request_activity for insert to authenticated with check (actor_id=auth.uid() and exists(select 1 from public.update_requests r where r.id=request_id));
-- Restrict update columns so ordinary users cannot reassign departments or edit immutable ownership fields.
revoke update on public.update_requests from authenticated;
grant update(status) on public.update_requests to authenticated;
create or replace function public.touch_request() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
create trigger phase7_touch before update on public.update_requests for each row execute function public.touch_request();
-- Realtime publication: only enable if not already included.
do $$ begin alter publication supabase_realtime add table public.update_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.request_activity; exception when duplicate_object then null; end $$;
-- BOOTSTRAP: after creating your first account, run this in SQL editor using its Auth Users UUID:
-- insert into public.memberships(user_id,department,role) values ('YOUR_AUTH_USER_UUID','Water Quality','admin');
-- Add other pilot users with role='member' and their actual departments.
-- For a production deployment, add admin-managed membership invitations, server-side audit triggers,
-- formal retention controls, SSO, and security review before ingesting government records.
