-- =============================================
-- AYKA CRM - Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Leads table
create table leads (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Basic Info
  name text not null,
  contact text,
  email text,
  city text,
  state text,
  occupation text,

  -- Assignment
  assigned_to text default 'Charchit',
  fbdm text,

  -- Franchise
  fm_type text check (fm_type in ('CF', 'MF', 'DF', 'SF', 'Collab')),

  -- Source
  source text default 'Facebook_Ads',

  -- Lead Classification
  lead_quality text check (lead_quality in ('#Hot_Lead', '#Warm_Lead', '#Cold_Lead', '#Low_Potential')),
  follow_up_status text check (follow_up_status in ('#First_Call', '#Followup_1', '#Followup_2', '#Meeting_Scheduled', '#Proposal_Sent', '#Lost', '#Contacted')),
  objection_tag text check (objection_tag in ('#Need_More_Time', '#ROI_Concern', '#Investment_Issue', '#Not_Interested', '#Discuss_With_Partner', '#Documents_Pending')),

  -- Remarks
  last_remark text,
  last_activity timestamp with time zone,

  -- Date of lead
  lead_date date
);

-- Row Level Security
alter table leads enable row level security;

-- Policy: authenticated users can do everything
create policy "Authenticated users can manage leads"
  on leads for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- Lead activity / remarks history
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

create policy "Authenticated users can manage lead activities"
  on lead_activities for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Index for fast search
create index leads_name_idx on leads using gin(to_tsvector('english', name));
create index leads_contact_idx on leads(contact);
create index leads_lead_quality_idx on leads(lead_quality);
create index leads_follow_up_status_idx on leads(follow_up_status);
create index leads_fm_type_idx on leads(fm_type);
create index lead_activities_lead_id_created_at_idx on lead_activities(lead_id, created_at desc);
