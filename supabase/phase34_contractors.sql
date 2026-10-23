-- Phase 34: Enterprise contractors and vendor management
-- Run ONLY against the isolated CivicOps Enterprise test Supabase project.
create table if not exists public.enterprise_contractors (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 name text not null,
 vendor_code text,
 category text not null default 'General services',
 contact_name text,
 contact_email text,
 contact_phone text,
 address text,
 status text not null default 'active' check (status in ('active','inactive','suspended')),
 performance_rating integer check (performance_rating between 1 and 5),
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,organization_id),
 unique(organization_id,vendor_code)
);
create table if not exists public.enterprise_contractor_facilities (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 contractor_id uuid not null,
 facility_id uuid not null,
 service_scope text,
 assigned_at timestamptz not null default now(),
 unique(organization_id,contractor_id,facility_id),
 foreign key (contractor_id,organization_id) references public.enterprise_contractors(id,organization_id) on delete cascade,
 foreign key (facility_id,organization_id) references public.enterprise_facilities(id,organization_id) on delete cascade
);
create table if not exists public.enterprise_contractor_contracts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 contractor_id uuid not null,
 reference text,
 title text not null,
 status text not null default 'draft' check(status in ('draft','active','expired','terminated','completed')),
 start_date date,
 end_date date,
 contract_value numeric(18,2) check(contract_value is null or contract_value>=0),
 currency text not null default 'GYD' check(currency ~ '^[A-Z]{3}$'),
 notes text,
 created_at timestamptz not null default now(),
 foreign key (contractor_id,organization_id) references public.enterprise_contractors(id,organization_id) on delete cascade
);
create table if not exists public.enterprise_contractor_credentials (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 contractor_id uuid not null,
 credential_type text not null check(credential_type in ('insurance','certification','license','other')),
 title text not null,
 issuer text,
 reference text,
 expires_on date,
 verified_on date,
 notes text,
 created_at timestamptz not null default now(),
 foreign key (contractor_id,organization_id) references public.enterprise_contractors(id,organization_id) on delete cascade
);
create index if not exists enterprise_contractors_org_idx on public.enterprise_contractors(organization_id,name);
create index if not exists enterprise_contractor_facilities_facility_idx on public.enterprise_contractor_facilities(organization_id,facility_id);
create index if not exists enterprise_contractor_contracts_end_idx on public.enterprise_contractor_contracts(organization_id,end_date);
create index if not exists enterprise_contractor_credentials_expiry_idx on public.enterprise_contractor_credentials(organization_id,expires_on);

-- RLS enforces organization membership for reads and elevated member roles for writes.
do $$ declare tbl text; begin
 foreach tbl in array array['enterprise_contractors','enterprise_contractor_facilities','enterprise_contractor_contracts','enterprise_contractor_credentials'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('drop policy if exists %I on public.%I',tbl||'_read',tbl);
  execute format('drop policy if exists %I on public.%I',tbl||'_write',tbl);
  execute format('create policy %I on public.%I for select to authenticated using (public.enterprise_has_access(organization_id))',tbl||'_read',tbl);
  execute format('create policy %I on public.%I for all to authenticated using (public.enterprise_has_access(organization_id,true)) with check (public.enterprise_has_access(organization_id,true))',tbl||'_write',tbl);
  execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
 end loop;
end $$;
