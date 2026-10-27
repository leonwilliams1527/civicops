-- Phase 28.5 delegated operational tasks. Enterprise Supabase ONLY.
-- Task grants are scoped to a facility and specific operation, never a whole module.
begin;
create table if not exists public.enterprise_delegated_tasks (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.enterprise_organizations(id) on delete cascade,
 facility_id uuid not null references public.enterprise_facilities(id) on delete cascade,
 assigned_to uuid not null references auth.users(id),
 assigned_by uuid not null references auth.users(id),
 task_type text not null check(task_type in ('asset_register','asset_update','inspection_conduct','contractor_compliance','facility_status','corrective_action')),
 title text not null check(length(trim(title)) between 3 and 180),
 instructions text,
 target_id uuid,
 status text not null default 'assigned' check(status in ('assigned','in_progress','submitted','approved','rejected','cancelled')),
 due_at timestamptz,
 expires_at timestamptz,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 review_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint delegated_task_expiry check(expires_at is null or expires_at > created_at)
);
create index if not exists enterprise_delegated_tasks_assignee_idx on public.enterprise_delegated_tasks(assigned_to,status);
create index if not exists enterprise_delegated_tasks_scope_idx on public.enterprise_delegated_tasks(organization_id,facility_id);
create table if not exists public.enterprise_delegated_task_events (
 id bigint generated always as identity primary key,
 task_id uuid not null references public.enterprise_delegated_tasks(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 event_type text not null,
 note text,
 created_at timestamptz not null default now()
);
create or replace function public.enterprise_can_manage_tasks(p_org uuid,p_facility uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.enterprise_is_org_admin(p_org) or
  (public.enterprise_can_view_facility(p_org,p_facility) and exists(
   select 1 from public.enterprise_members m where m.organization_id=p_org
   and m.user_id=(select auth.uid()) and m.role='manager'));
$$;
create or replace function public.enterprise_has_task_grant(p_org uuid,p_facility uuid,p_type text,p_target uuid default null)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.enterprise_delegated_tasks t
  where t.organization_id=p_org and t.facility_id=p_facility
   and t.assigned_to=(select auth.uid()) and t.task_type=p_type
   and t.status in ('assigned','in_progress','rejected')
   and (t.expires_at is null or t.expires_at>now())
   and (t.target_id is null or t.target_id=p_target)
   and public.enterprise_can_view_facility(p_org,p_facility));
$$;
revoke all on function public.enterprise_can_manage_tasks(uuid,uuid) from public;
revoke all on function public.enterprise_has_task_grant(uuid,uuid,text,uuid) from public;
grant execute on function public.enterprise_can_manage_tasks(uuid,uuid) to authenticated;
grant execute on function public.enterprise_has_task_grant(uuid,uuid,text,uuid) to authenticated;
alter table public.enterprise_delegated_tasks enable row level security;
alter table public.enterprise_delegated_task_events enable row level security;
drop policy if exists delegated_tasks_read on public.enterprise_delegated_tasks;
create policy delegated_tasks_read on public.enterprise_delegated_tasks
for select to authenticated using (assigned_to=(select auth.uid()) or public.enterprise_can_manage_tasks(organization_id,facility_id));
drop policy if exists delegated_tasks_create on public.enterprise_delegated_tasks;
create policy delegated_tasks_create on public.enterprise_delegated_tasks
for insert to authenticated with check(
 assigned_by=(select auth.uid()) and status='assigned'
 and public.enterprise_can_manage_tasks(organization_id,facility_id)
 and public.enterprise_can_view_facility(organization_id,facility_id)
 and exists(select 1 from public.enterprise_members m where m.organization_id=enterprise_delegated_tasks.organization_id and m.user_id=assigned_to)
 and exists(select 1 from public.enterprise_facility_members fm where fm.organization_id=enterprise_delegated_tasks.organization_id and fm.facility_id=enterprise_delegated_tasks.facility_id and fm.user_id=assigned_to)
);
-- State transitions are performed by controlled RPC only, not unrestricted UPDATE.
create or replace function public.enterprise_transition_delegated_task(p_task uuid,p_status text,p_note text default null)
returns public.enterprise_delegated_tasks language plpgsql security definer set search_path=''
as $$
declare t public.enterprise_delegated_tasks; me uuid := (select auth.uid()); manager_ok boolean;
begin
 select * into t from public.enterprise_delegated_tasks where id=p_task for update;
 if not found or me is null then raise exception 'Task unavailable'; end if;
 manager_ok:=public.enterprise_can_manage_tasks(t.organization_id,t.facility_id);
 if p_status='in_progress' and t.assigned_to=me and t.status in ('assigned','rejected')
   and (t.expires_at is null or t.expires_at>now()) then null;
 elsif p_status='submitted' and t.assigned_to=me and t.status='in_progress'
   and (t.expires_at is null or t.expires_at>now()) then null;
 elsif p_status in ('approved','rejected') and manager_ok and me<>t.assigned_to and t.status='submitted' then null;
 elsif p_status='cancelled' and manager_ok and t.status not in ('approved','cancelled') then null;
 else raise exception 'Unauthorized task transition'; end if;
 update public.enterprise_delegated_tasks set status=p_status,updated_at=now(),
 submitted_at=case when p_status='submitted' then now() else submitted_at end,
 reviewed_at=case when p_status in ('approved','rejected') then now() else reviewed_at end,
 reviewed_by=case when p_status in ('approved','rejected') then me else reviewed_by end,
 review_notes=case when p_status in ('approved','rejected') then p_note else review_notes end
 where id=p_task returning * into t;
 insert into public.enterprise_delegated_task_events(task_id,actor_id,event_type,note)
 values(p_task,me,p_status,p_note);
 return t;
end;$$;
revoke all on function public.enterprise_transition_delegated_task(uuid,text,text) from public;
grant execute on function public.enterprise_transition_delegated_task(uuid,text,text) to authenticated;
drop policy if exists delegated_task_events_read on public.enterprise_delegated_task_events;
create policy delegated_task_events_read on public.enterprise_delegated_task_events
for select to authenticated using(exists(select 1 from public.enterprise_delegated_tasks t
 where t.id=task_id and (t.assigned_to=(select auth.uid()) or public.enterprise_can_manage_tasks(t.organization_id,t.facility_id))));
grant select,insert on public.enterprise_delegated_tasks to authenticated;
grant select on public.enterprise_delegated_task_events to authenticated;
commit;
