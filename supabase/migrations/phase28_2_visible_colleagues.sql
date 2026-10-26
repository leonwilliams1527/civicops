-- Phase 28.2: scoped employee directory. Enterprise Supabase only.
-- Security-definer function returns only coworkers sharing an assigned facility,
-- or all members for an owner/admin. No client-supplied user identity is trusted.
create or replace function public.enterprise_visible_colleagues(p_organization_id uuid)
returns table(user_id uuid, role text, display_name text, job_title text)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, m.role::text, p.display_name::text, p.job_title::text
  from public.enterprise_members m
  left join public.enterprise_employee_profiles p on p.user_id = m.user_id
  where m.organization_id = p_organization_id
    and exists (
      select 1 from public.enterprise_members self
      where self.organization_id = p_organization_id and self.user_id = (select auth.uid())
    )
    and (
      public.enterprise_is_org_admin(p_organization_id)
      or m.user_id = (select auth.uid())
      or exists (
        select 1 from public.enterprise_facility_members mine
        join public.enterprise_facility_members coworker
          on coworker.organization_id = mine.organization_id
         and coworker.facility_id = mine.facility_id
        where mine.organization_id = p_organization_id
          and mine.user_id = (select auth.uid())
          and coworker.user_id = m.user_id
      )
    );
$$;
revoke all on function public.enterprise_visible_colleagues(uuid) from public;
grant execute on function public.enterprise_visible_colleagues(uuid) to authenticated;
