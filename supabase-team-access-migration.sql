-- AYKA CRM - Admin / manager / assigned user access migration
-- Run this once in Supabase SQL Editor after the activity migration.

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  email text not null,
  display_name text not null,
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  is_active boolean not null default true
);

alter table profiles enable row level security;

insert into profiles (id, email, display_name, role, is_active)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'User'),
  'user',
  true
from auth.users
on conflict (id) do nothing;

-- Bootstrap: make the first existing user admin so the app is not locked.
with first_user as (
  select id from profiles order by created_at asc limit 1
)
update profiles
set role = 'admin'
where id in (select id from first_user)
  and not exists (select 1 from profiles where role = 'admin');

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User'),
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'assigned_user_id'
  ) then
    alter table leads add column assigned_user_id uuid references profiles(id);
  end if;
end
$$;

update leads
set assigned_user_id = profiles.id
from profiles
where leads.assigned_user_id is null
  and lower(leads.assigned_to) = lower(profiles.display_name);

drop policy if exists "Authenticated users can manage leads" on leads;
drop policy if exists "Admins and managers can manage leads" on leads;
drop policy if exists "Users can view assigned leads" on leads;
drop policy if exists "Users can update assigned leads" on leads;

create policy "Admins and managers can manage leads"
  on leads for all
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

create policy "Users can view assigned leads"
  on leads for select
  using (assigned_user_id = auth.uid());

create policy "Users can update assigned leads"
  on leads for update
  using (assigned_user_id = auth.uid())
  with check (assigned_user_id = auth.uid());

drop policy if exists "Authenticated users can manage lead activities" on lead_activities;
drop policy if exists "Admins and managers can manage lead activities" on lead_activities;
drop policy if exists "Users can view assigned lead activities" on lead_activities;
drop policy if exists "Users can create assigned lead activities" on lead_activities;

create policy "Admins and managers can manage lead activities"
  on lead_activities for all
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

create policy "Users can view assigned lead activities"
  on lead_activities for select
  using (
    exists (
      select 1 from leads
      where leads.id = lead_activities.lead_id
        and leads.assigned_user_id = auth.uid()
    )
  );

create policy "Users can create assigned lead activities"
  on lead_activities for insert
  with check (
    exists (
      select 1 from leads
      where leads.id = lead_activities.lead_id
        and leads.assigned_user_id = auth.uid()
    )
  );

drop policy if exists "Users can read active profiles" on profiles;
drop policy if exists "Admins and managers can manage profiles" on profiles;

create policy "Users can read active profiles"
  on profiles for select
  using (is_active = true and auth.role() = 'authenticated');

create policy "Admins and managers can manage profiles"
  on profiles for all
  using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

create index if not exists profiles_role_idx on profiles(role);
create index if not exists leads_assigned_user_id_idx on leads(assigned_user_id);
