-- Phase 28.3: Enterprise facility-scoped operational RLS.
-- Apply ONLY in the Enterprise Supabase project, after Phase 28.1 and 28.2.
-- This migration REPLACES all existing policies on the four listed Enterprise
-- operational tables; review against any custom integrations before running.
begin;

create or replace function public.enterprise_can_write_facility(p_org uuid,p_facility uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.enterprise_is_org_admin(p_org)
    or (
      public.enterprise_can_view_facility(p_org,p_facility)
      and exists (
        select 1 from public.enterprise_members m
        where m.organization_id=p_org
          and m.user_id=(select auth.uid())
          and m.role in ('operator','manager')
      )
    );
$$;
revoke all on function public.enterprise_can_write_facility(uuid,uuid) from public;
grant execute on function public.enterprise_can_write_facility(uuid,uuid) to authenticated;

-- Remove old permissive policies: PostgreSQL ORs permissive policies together.
do $$
declare t text; p record;
begin
  foreach t in array array['enterprise_facilities','enterprise_assets',
    'enterprise_inspections','enterprise_findings'] loop
    for p in select policyname from pg_policies
      where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

create policy enterprise_facilities_read_scoped on public.enterprise_facilities
for select to authenticated using (public.enterprise_can_view_facility(organization_id,id));
create policy enterprise_facilities_insert_admin on public.enterprise_facilities
for insert to authenticated with check (public.enterprise_is_org_admin(organization_id));
create policy enterprise_facilities_update_admin on public.enterprise_facilities
for update to authenticated using (public.enterprise_is_org_admin(organization_id))
with check (public.enterprise_is_org_admin(organization_id));
create policy enterprise_facilities_delete_admin on public.enterprise_facilities
for delete to authenticated using (public.enterprise_is_org_admin(organization_id));

create policy enterprise_assets_read_scoped on public.enterprise_assets
for select to authenticated using (public.enterprise_can_view_facility(organization_id,facility_id));
create policy enterprise_assets_insert_scoped on public.enterprise_assets
for insert to authenticated with check (public.enterprise_can_write_facility(organization_id,facility_id));
create policy enterprise_assets_update_scoped on public.enterprise_assets
for update to authenticated using (public.enterprise_can_write_facility(organization_id,facility_id))
with check (public.enterprise_can_write_facility(organization_id,facility_id));
create policy enterprise_assets_delete_admin on public.enterprise_assets
for delete to authenticated using (public.enterprise_is_org_admin(organization_id));

create policy enterprise_inspections_read_scoped on public.enterprise_inspections
for select to authenticated using (public.enterprise_can_view_facility(organization_id,facility_id));
create policy enterprise_inspections_insert_scoped on public.enterprise_inspections
for insert to authenticated with check (public.enterprise_can_write_facility(organization_id,facility_id));
create policy enterprise_inspections_update_scoped on public.enterprise_inspections
for update to authenticated using (public.enterprise_can_write_facility(organization_id,facility_id))
with check (public.enterprise_can_write_facility(organization_id,facility_id));
create policy enterprise_inspections_delete_admin on public.enterprise_inspections
for delete to authenticated using (public.enterprise_is_org_admin(organization_id));

create or replace function public.enterprise_can_view_inspection(p_org uuid,p_inspection uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.enterprise_inspections i
    where i.id=p_inspection and i.organization_id=p_org
      and public.enterprise_can_view_facility(p_org,i.facility_id));
$$;
create or replace function public.enterprise_can_write_inspection(p_org uuid,p_inspection uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.enterprise_inspections i
    where i.id=p_inspection and i.organization_id=p_org
      and public.enterprise_can_write_facility(p_org,i.facility_id));
$$;
revoke all on function public.enterprise_can_view_inspection(uuid,uuid) from public;
revoke all on function public.enterprise_can_write_inspection(uuid,uuid) from public;
grant execute on function public.enterprise_can_view_inspection(uuid,uuid) to authenticated;
grant execute on function public.enterprise_can_write_inspection(uuid,uuid) to authenticated;

create policy enterprise_findings_read_scoped on public.enterprise_findings
for select to authenticated using (public.enterprise_can_view_inspection(organization_id,inspection_id));
create policy enterprise_findings_insert_scoped on public.enterprise_findings
for insert to authenticated with check (public.enterprise_can_write_inspection(organization_id,inspection_id));
create policy enterprise_findings_update_scoped on public.enterprise_findings
for update to authenticated using (public.enterprise_can_write_inspection(organization_id,inspection_id))
with check (public.enterprise_can_write_inspection(organization_id,inspection_id));
create policy enterprise_findings_delete_admin on public.enterprise_findings
for delete to authenticated using (public.enterprise_is_org_admin(organization_id));

commit;
