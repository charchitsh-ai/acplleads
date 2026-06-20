-- ============================================================
-- Email Templates Table
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  description text,
  is_default boolean DEFAULT false
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON email_templates FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert templates"
  ON email_templates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update templates"
  ON email_templates FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete templates"
  ON email_templates FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- SMTP Configuration Table (single row per org)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  provider text DEFAULT 'smtp', -- 'smtp' | 'resend'
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_secure boolean DEFAULT false,
  smtp_user text,
  smtp_pass text,
  from_name text DEFAULT 'AYKA Alliance',
  from_email text,
  resend_api_key text,
  is_active boolean DEFAULT true
);

ALTER TABLE email_smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage smtp config"
  ON email_smtp_config FOR ALL USING (auth.role() = 'authenticated');

-- Seed default templates
INSERT INTO email_templates (name, subject, body, description, is_default) VALUES
(
  'Follow-up Reminder',
  'Following up on your inquiry — AYKA Alliance',
  'Dear {name},

I hope you are doing well! I am reaching out to follow up on our previous conversation regarding the AYKA Alliance franchise opportunity.

We believe your profile as a {fm_type} candidate from {city}, {state} is an excellent fit for our program.

Would you be available for a quick call this week? Please let me know a convenient time.

Looking forward to hearing from you.

Warm regards,
AYKA Alliance Team',
  'Standard follow-up email for leads',
  true
),
(
  'Meeting Request',
  'Meeting Request — AYKA Alliance Franchise Discussion',
  'Dear {name},

Thank you for your interest in the AYKA Alliance franchise opportunity!

I would like to schedule a meeting to walk you through our business model for the {fm_type} franchise type.

Details:
• Mode: Online (Google Meet / Zoom) or In-Person
• Duration: 30-45 minutes
• Your Location: {city}, {state}

Please reply with your preferred date and time.

Best regards,
AYKA Alliance Team',
  'Meeting invitation email',
  true
),
(
  'Proposal Introduction',
  'Exclusive Franchise Proposal — AYKA Alliance',
  'Dear {name},

We are delighted to share our exclusive franchise proposal with you!

Based on your profile ({fm_type} - {city}, {state}), we believe this is an ideal opportunity for you.

AYKA Alliance Highlights:
✅ Low investment, high returns
✅ Comprehensive training & support
✅ Exclusive territorial rights
✅ Proven business model

We look forward to welcoming you to the AYKA family!

Warm regards,
AYKA Alliance Team',
  'Initial proposal email for new leads',
  true
),
(
  'Thank You (Post Meeting)',
  'Thank you for meeting with us — AYKA Alliance',
  'Dear {name},

Thank you for taking the time to meet with us today! It was a pleasure speaking with you.

As discussed, your interest in the {fm_type} franchise for {city}, {state} region is very promising.

Next Steps:
1. Review the detailed proposal document
2. Connect with our existing partners
3. Schedule a follow-up if needed

Feel free to reach out anytime. We are assigned {assigned_to} as your dedicated contact.

Looking forward to working together!

Warm regards,
AYKA Alliance Team',
  'Post-meeting thank you email',
  true
),
(
  'Welcome / Introduction',
  'Welcome to AYKA Alliance — Your Franchise Journey Begins!',
  'Dear {name},

Welcome! We are thrilled to connect with you regarding the AYKA Alliance franchise opportunity.

Your Details on File:
• Name: {name}
• Location: {city}, {state}
• Franchise Type of Interest: {fm_type}
• Contact: {phone}

Our team ({assigned_to}) will reach out to you shortly to discuss the exciting opportunities available in your region.

Warm regards,
AYKA Alliance Team',
  'Welcome email for new leads',
  true
);
