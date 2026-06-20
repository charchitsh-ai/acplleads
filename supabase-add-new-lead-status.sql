-- =============================================
-- Migration: Add #New_Lead to follow_up_status check constraint
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop the old check constraint
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_follow_up_status_check;

-- Add new constraint that includes #New_Lead
ALTER TABLE leads
  ADD CONSTRAINT leads_follow_up_status_check
  CHECK (follow_up_status IN (
    '#New_Lead',
    '#First_Call',
    '#Followup_1',
    '#Followup_2',
    '#Meeting_Scheduled',
    '#Proposal_Sent',
    '#Contacted',
    '#Lost'
  ));
