
-- Phase 34.3
-- Enterprise contractor contract-to-facility relationships
-- Run ONLY in civicops-enterprise-test.

begin;

create table if not exists public.enterprise_contractor_contract_facilities (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.enterprise_organizations(id)
    on delete cascade,

  contract_id uuid not null
    references public.enterprise_contractor_contracts(id)
    on delete cascade,

  facility_id uuid not null
    references public.enterprise_facilities(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique (organization_id, contract_id, facility_id)
);

-- Enforce that both referenced records belong
-- to the same organization as the relationship.
create or replace function
public.enterprise_validate_contract_facility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.enterprise_contractor_contracts c
    where c.id = new.contract_id
      and c.organization_id = new.organization_id
  ) then
    raise exception
      'Contract does not belong to this organization';
  end if;

  if not exists (
    select 1
    from public.enterprise_facilities f
    where f.id = new.facility_id
      and f.organization_id = new.organization_id
  ) then
    raise exception
      'Facility does not belong to this organization';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enterprise_contract_facility_validate
on public.enterprise_contractor_contract_facilities;

create trigger enterprise_contract_facility_validate
before insert or update
on public.enterprise_contractor_contract_facilities
for each row
execute function
public.enterprise_validate_contract_facility();

create index if not exists
  enterprise_contract_facilities_org_facility_idx
on public.enterprise_contractor_contract_facilities
(organization_id, facility_id);

create index if not exists
  enterprise_contract_facilities_org_contract_idx
on public.enterprise_contractor_contract_facilities
(organization_id, contract_id);

alter table
  public.enterprise_contractor_contract_facilities
enable row level security;

drop policy if exists
  enterprise_contract_facilities_read
on public.enterprise_contractor_contract_facilities;

drop policy if exists
  enterprise_contract_facilities_write
on public.enterprise_contractor_contract_facilities;

create policy enterprise_contract_facilities_read
on public.enterprise_contractor_contract_facilities
for select
to authenticated
using (
  public.enterprise_has_access(organization_id)
);

create policy enterprise_contract_facilities_write
on public.enterprise_contractor_contract_facilities
for all
to authenticated
using (
  public.enterprise_has_access(organization_id, true)
)
with check (
  public.enterprise_has_access(organization_id, true)
);

grant select, insert, update, delete
on public.enterprise_contractor_contract_facilities
to authenticated;

commit;
