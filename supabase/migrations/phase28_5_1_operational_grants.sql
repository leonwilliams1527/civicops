-- Phase 28.5.1: additive delegated grants. Enterprise project only.
-- Keep existing manager/operator privileges; add narrowly scoped employee grants.
begin;
create or replace function public.enterprise_has_task_grant(p_org uuid,p_facility uuid,p_type text,p_target uuid default null)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.enterprise_delegated_tasks t
 where t.organization_id=p_org and t.facility_id=p_facility
 and t.assigned_to=(select auth.uid()) and t.task_type=p_type
 and t.status in ('assigned','in_progress','rejected')
 and (t.expires_at is null or t.expires_at>now())
 and ((p_target is null and t.target_id is null) or (p_target is not null and t.target_id=p_target))
 and public.enterprise_can_view_facility(p_org,p_facility));
$$;
-- Grant is operation-specific. INSERT grants are limited to new records;
-- existing asset updates require a task bound to that asset ID.
drop policy if exists enterprise_assets_insert_delegated on public.enterprise_assets;
create policy enterprise_assets_insert_delegated on public.enterprise_assets
for insert to authenticated with check(
 public.enterprise_has_task_grant(organization_id,facility_id,'asset_register',null));
drop policy if exists enterprise_assets_update_delegated on public.enterprise_assets;
create policy enterprise_assets_update_delegated on public.enterprise_assets
for update to authenticated using(
 public.enterprise_has_task_grant(organization_id,facility_id,'asset_update',id))
with check(public.enterprise_has_task_grant(organization_id,facility_id,'asset_update',id));
drop policy if exists enterprise_inspections_insert_delegated on public.enterprise_inspections;
create policy enterprise_inspections_insert_delegated on public.enterprise_inspections
for insert to authenticated with check(
 public.enterprise_has_task_grant(organization_id,facility_id,'inspection_conduct',null));
-- Findings belong to an inspection: delegated access must be bound to the parent inspection.
create or replace function public.enterprise_can_add_delegated_finding(p_org uuid,p_inspection uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.enterprise_inspections i
 where i.organization_id=p_org and i.id=p_inspection
 and public.enterprise_has_task_grant(p_org,i.facility_id,'inspection_conduct',i.id));
$$;
revoke all on function public.enterprise_can_add_delegated_finding(uuid,uuid) from public;
grant execute on function public.enterprise_can_add_delegated_finding(uuid,uuid) to authenticated;
drop policy if exists enterprise_findings_insert_delegated on public.enterprise_findings;
create policy enterprise_findings_insert_delegated on public.enterprise_findings
for insert to authenticated with check(
 public.enterprise_can_add_delegated_finding(organization_id,inspection_id));
commit;
