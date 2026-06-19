-- AYKA CRM - User activity audit logs
-- Run this once in Supabase SQL Editor after team access migration.

create table if not exists user_activity_logs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  actor_email text,
  activity_type text not null check (
    activity_type in (
      'login',
      'logout',
      'lead_created',
      'lead_updated',
      'lead_deleted',
      'lead_remark',
      'lead_assigned',
      'user_created'
    )
  ),
  lead_id uuid references leads(id) on delete set null,
  lead_name text,
  target_user_id uuid references profiles(id) on delete set null,
  target_user_name text,
  detail text not null
);

alter table user_activity_logs enable row level security;

drop policy if exists "Users can create own activity logs" on user_activity_logs;
drop policy if exists "Admins and managers can read activity logs" on user_activity_logs;
drop policy if exists "Admins and managers can manage activity logs" on user_activity_logs;

create policy "Users can create own activity logs"
  on user_activity_logs for insert
  with check (actor_id = auth.uid());

create policy "Admins and managers can read activity logs"
  on user_activity_logs for select
  using (public.current_user_role() in ('admin', 'manager'));

create policy "Admins and managers can manage activity logs"
  on user_activity_logs for all
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

create index if not exists user_activity_logs_created_at_idx on user_activity_logs(created_at desc);
create index if not exists user_activity_logs_actor_id_idx on user_activity_logs(actor_id);
create index if not exists user_activity_logs_lead_id_idx on user_activity_logs(lead_id);
