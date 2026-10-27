-- Phase 28.5.2: Validate task targets and record assignment events.
-- Run in Enterprise Supabase only, after Phase 28.5 and 28.5.1.
begin;
create or replace function public.enterprise_validate_delegated_task()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.task_type='asset_update' then
   if new.target_id is null or not exists (
     select 1 from public.enterprise_assets a where a.id=new.target_id
     and a.organization_id=new.organization_id and a.facility_id=new.facility_id
   ) then raise exception 'Asset update task must reference an asset in the assigned facility'; end if;
 elsif new.task_type='inspection_conduct' and new.target_id is not null then
   if not exists (
     select 1 from public.enterprise_inspections i where i.id=new.target_id
     and i.organization_id=new.organization_id and i.facility_id=new.facility_id
   ) then raise exception 'Inspection task target must belong to the assigned facility'; end if;
 elsif new.task_type in ('asset_register','facility_status','corrective_action') and new.target_id is not null then
   raise exception 'This task type does not support a target record';
 end if;
 if new.expires_at is not null and new.expires_at<=now() then
   raise exception 'Task expiration must be in the future';
 end if;
 return new;
end;$$;
drop trigger if exists enterprise_validate_delegated_task_insert on public.enterprise_delegated_tasks;
create trigger enterprise_validate_delegated_task_insert
before insert on public.enterprise_delegated_tasks
for each row execute function public.enterprise_validate_delegated_task();
create or replace function public.enterprise_log_delegated_task_assignment()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.enterprise_delegated_task_events(task_id,actor_id,event_type,note)
 values(new.id,new.assigned_by,'assigned',null);
 return new;
end;$$;
drop trigger if exists enterprise_log_delegated_task_assignment_insert on public.enterprise_delegated_tasks;
create trigger enterprise_log_delegated_task_assignment_insert
after insert on public.enterprise_delegated_tasks
for each row execute function public.enterprise_log_delegated_task_assignment();
-- Lock down direct writes: task status changes must go through transition RPC.
revoke update,delete on public.enterprise_delegated_tasks from authenticated;
revoke insert,update,delete on public.enterprise_delegated_task_events from authenticated;
commit;
