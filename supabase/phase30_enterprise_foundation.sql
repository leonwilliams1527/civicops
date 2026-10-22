-- Phase 30: additive, deny-by-default enterprise facilities foundation.
-- Run only after testing on a separate Supabase project. Does not modify municipal tables.
create table if not exists public.enterprise_organizations (
 id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
 created_at timestamptz not null default now()
);
create table if not exists public.enterprise_members (
 organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('viewer','operator','manager')),
 primary key (organization_id,user_id)
);
create table if not exists public.enterprise_facilities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 name text not null, region text, address text, latitude numeric(10,7), longitude numeric(10,7),
 status text not null default 'operational' check(status in ('operational','attention','critical','inactive')),
 description text, created_at timestamptz not null default now(),
 constraint enterprise_lat check(latitude is null or latitude between -90 and 90),
 constraint enterprise_lon check(longitude is null or longitude between -180 and 180),
 constraint enterprise_coords_pair check((latitude is null)=(longitude is null))
);
create table if not exists public.enterprise_actions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 facility_id uuid not null references public.enterprise_facilities(id) on delete cascade,
 title text not null, priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
 status text not null default 'open' check(status in ('open','in_progress','resolved','verified')),
 due_date date, created_at timestamptz not null default now(),
 unique(id,organization_id)
);
create unique index if not exists enterprise_facilities_id_org on public.enterprise_facilities(id,organization_id);
alter table public.enterprise_actions add constraint enterprise_actions_facility_org_fk foreign key(facility_id,organization_id) references public.enterprise_facilities(id,organization_id);
create index if not exists enterprise_facilities_org_idx on public.enterprise_facilities(organization_id);
create index if not exists enterprise_actions_org_idx on public.enterprise_actions(organization_id,facility_id);
create or replace function public.enterprise_has_access(p_org uuid, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.enterprise_members m where m.organization_id=p_org and m.user_id=(select auth.uid()) and (not p_write or m.role in ('operator','manager')));
$$;
revoke all on function public.enterprise_has_access(uuid,boolean) from public;
grant execute on function public.enterprise_has_access(uuid,boolean) to authenticated;
alter table public.enterprise_organizations enable row level security;
alter table public.enterprise_members enable row level security;
alter table public.enterprise_facilities enable row level security;
alter table public.enterprise_actions enable row level security;
create policy enterprise_org_read on public.enterprise_organizations for select to authenticated using (public.enterprise_has_access(id));
create policy enterprise_members_read on public.enterprise_members for select to authenticated using (public.enterprise_has_access(organization_id));
create policy enterprise_facilities_read on public.enterprise_facilities for select to authenticated using (public.enterprise_has_access(organization_id));
create policy enterprise_facilities_write on public.enterprise_facilities for all to authenticated using (public.enterprise_has_access(organization_id,true)) with check (public.enterprise_has_access(organization_id,true));
create policy enterprise_actions_read on public.enterprise_actions for select to authenticated using (public.enterprise_has_access(organization_id));
create policy enterprise_actions_write on public.enterprise_actions for all to authenticated using (public.enterprise_has_access(organization_id,true)) with check (public.enterprise_has_access(organization_id,true));
-- Provision organizations and manager membership only from a trusted, audited administrator process.
-- No browser-accessible organization or membership creation policies are provided.
