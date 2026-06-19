-- AYKA CRM - Lead activity / remarks history migration
-- Run this once in Supabase SQL Editor for an existing project.

create extension if not exists "uuid-ossp";

create table if not exists lead_activities (
  id uuid default uuid_generate_v4() primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  created_at timestamp with time zone default now(),
  activity_type text not null default 'remark'
    check (activity_type in ('remark', 'created', 'updated')),
  remark text not null,
  created_by text
);

alter table lead_activities enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_activities'
      and policyname = 'Authenticated users can manage lead activities'
  ) then
    create policy "Authenticated users can manage lead activities"
      on lead_activities for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end
$$;

create index if not exists lead_activities_lead_id_created_at_idx
  on lead_activities(lead_id, created_at desc);

insert into lead_activities (lead_id, created_at, activity_type, remark, created_by)
select id, coalesce(last_activity, updated_at, created_at), 'remark', last_remark, assigned_to
from leads
where nullif(trim(last_remark), '') is not null
  and not exists (
    select 1
    from lead_activities
    where lead_activities.lead_id = leads.id
      and lead_activities.remark = leads.last_remark
  );
