-- CivicOps Enterprise Phase 28.1: location membership foundation
-- Apply ONLY to the dedicated Enterprise Supabase project.
-- This migration does not change existing operational-table RLS policies.
begin;
create table if not exists public.enterprise_facility_members (
  organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
  facility_id uuid not null references public.enterprise_facilities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  primary key (facility_id,user_id)
);
create index if not exists enterprise_facility_members_user_org_idx
  on public.enterprise_facility_members(user_id,organization_id);
create index if not exists enterprise_facility_members_org_facility_idx
  on public.enterprise_facility_members(organization_id,facility_id);

create or replace function public.enterprise_is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.enterprise_members m
    where m.organization_id=p_org and m.user_id=(select auth.uid())
    and m.role in ('owner','admin'));
$$;

create or replace function public.enterprise_can_view_facility(p_org uuid,p_facility uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.enterprise_is_org_admin(p_org)
    or exists(select 1 from public.enterprise_facility_members fm
      join public.enterprise_facilities f on f.id=fm.facility_id
      where fm.organization_id=p_org and fm.facility_id=p_facility
        and f.organization_id=p_org and fm.user_id=(select auth.uid()));
$$;

create or replace function public.enterprise_can_view_colleague(p_org uuid,p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_user=(select auth.uid()) or public.enterprise_is_org_admin(p_org)
    or exists(select 1 from public.enterprise_facility_members mine
      join public.enterprise_facility_members theirs
        on mine.facility_id=theirs.facility_id
        and mine.organization_id=theirs.organization_id
      where mine.organization_id=p_org
        and mine.user_id=(select auth.uid()) and theirs.user_id=p_user);
$$;

revoke all on function public.enterprise_is_org_admin(uuid) from public;
revoke all on function public.enterprise_can_view_facility(uuid,uuid) from public;
revoke all on function public.enterprise_can_view_colleague(uuid,uuid) from public;
grant execute on function public.enterprise_is_org_admin(uuid) to authenticated;
grant execute on function public.enterprise_can_view_facility(uuid,uuid) to authenticated;
grant execute on function public.enterprise_can_view_colleague(uuid,uuid) to authenticated;

alter table public.enterprise_facility_members enable row level security;
drop policy if exists enterprise_facility_members_select on public.enterprise_facility_members;
create policy enterprise_facility_members_select on public.enterprise_facility_members
for select to authenticated using (
  user_id=(select auth.uid()) or public.enterprise_is_org_admin(organization_id)
);
drop policy if exists enterprise_facility_members_insert on public.enterprise_facility_members;
create policy enterprise_facility_members_insert on public.enterprise_facility_members
for insert to authenticated with check (
  public.enterprise_is_org_admin(organization_id)
  and exists(select 1 from public.enterprise_facilities f
    where f.id=facility_id and f.organization_id=organization_id)
  and exists(select 1 from public.enterprise_members m
    where m.organization_id=enterprise_facility_members.organization_id
      and m.user_id=enterprise_facility_members.user_id)
);
drop policy if exists enterprise_facility_members_delete on public.enterprise_facility_members;
create policy enterprise_facility_members_delete on public.enterprise_facility_members
for delete to authenticated using (public.enterprise_is_org_admin(organization_id));
grant select,insert,delete on public.enterprise_facility_members to authenticated;
commit;
