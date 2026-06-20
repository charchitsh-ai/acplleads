-- Email Logs Table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  sent_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_name text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  lead_name text,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_used text,
  status text DEFAULT 'sent' -- 'sent' | 'failed'
);

-- Enable Row Level Security
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view email logs
CREATE POLICY "Authenticated users can view email logs"
  ON email_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert email logs
CREATE POLICY "Authenticated users can insert email logs"
  ON email_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
