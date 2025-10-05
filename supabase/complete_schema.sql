-- Create billing_customers table
CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  markup_percentage DECIMAL DEFAULT 0,
  auto_invoice_enabled BOOLEAN DEFAULT false,
  billing_contact_name TEXT,
  billing_address TEXT,
  phone_number TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  notes TEXT,

  CONSTRAINT valid_markup CHECK (markup_percentage >= 0 AND markup_percentage <= 10000)
);

-- Enable RLS on billing_customers
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy for billing_customers (Super Users with MFA only)
CREATE POLICY "billing_customers_super_user_access" ON billing_customers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.role = 'Super User'
        AND user_settings.fresh_mfa_enabled = true
        AND user_settings.fresh_mfa_setup_completed = true
    )
  );

-- Create invoice_records table
CREATE TABLE IF NOT EXISTS invoice_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  billing_customer_id UUID REFERENCES billing_customers(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,

  -- Billing period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,

  -- Usage metrics (NO PHI)
  total_chats INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_sms_segments INTEGER DEFAULT 0,
  total_call_minutes DECIMAL DEFAULT 0,

  -- Cost breakdown (all in CAD)
  twilio_sms_cost_cad DECIMAL NOT NULL DEFAULT 0,
  twilio_voice_cost_cad DECIMAL NOT NULL DEFAULT 0,
  retell_ai_chat_cost_cad DECIMAL NOT NULL DEFAULT 0,
  retell_ai_voice_cost_cad DECIMAL NOT NULL DEFAULT 0,
  subtotal_cad DECIMAL NOT NULL,
  markup_amount_cad DECIMAL DEFAULT 0,
  total_amount_cad DECIMAL NOT NULL,

  -- Invoice status
  invoice_status TEXT DEFAULT 'draft',
  stripe_invoice_url TEXT,
  stripe_invoice_pdf_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_date DATE,

  -- Audit
  created_by UUID,

  CONSTRAINT valid_status CHECK (
    invoice_status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')
  ),
  CONSTRAINT valid_period CHECK (billing_period_end >= billing_period_start)
);

-- Enable RLS on invoice_records
ALTER TABLE invoice_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy for invoice_records
CREATE POLICY "invoice_records_super_user_access" ON invoice_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_settings.user_id = auth.uid()
        AND user_settings.role = 'Super User'
        AND user_settings.fresh_mfa_enabled = true
        AND user_settings.fresh_mfa_setup_completed = true
    )
  );

-- Create billing_settings table
CREATE TABLE IF NOT EXISTS billing_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE,

  -- Stripe configuration (encrypted)
  stripe_api_key_encrypted TEXT,
  stripe_publishable_key TEXT,
  stripe_test_mode BOOLEAN DEFAULT true,

  -- Invoice defaults
  default_markup_percentage DECIMAL DEFAULT 0,
  default_due_date_days INTEGER DEFAULT 30,
  default_invoice_note TEXT,
  invoice_footer_text TEXT,

  -- Automation
  auto_invoice_enabled BOOLEAN DEFAULT false,
  auto_invoice_day_of_month INTEGER DEFAULT 1,
  auto_invoice_time TEXT DEFAULT '00:00',
  auto_send_invoices BOOLEAN DEFAULT false,

  -- Notifications
  notification_email TEXT,
  notify_on_invoice_generated BOOLEAN DEFAULT true,
  notify_on_payment_received BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_invoice_day CHECK (
    auto_invoice_day_of_month >= 1 AND auto_invoice_day_of_month <= 28
  ),
  CONSTRAINT valid_due_days CHECK (default_due_date_days > 0)
);

-- Enable RLS on billing_settings
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy for billing_settings
CREATE POLICY "billing_settings_own_access" ON billing_settings
  FOR ALL
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_billing_customers_email ON billing_customers(customer_email);
CREATE INDEX idx_billing_customers_stripe_id ON billing_customers(stripe_customer_id);
CREATE INDEX idx_invoice_records_customer_id ON invoice_records(billing_customer_id);
CREATE INDEX idx_invoice_records_period_start ON invoice_records(billing_period_start);
CREATE INDEX idx_invoice_records_status ON invoice_records(invoice_status);
CREATE INDEX idx_invoice_records_stripe_id ON invoice_records(stripe_invoice_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_billing_customers_updated_at BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_settings_updated_at BEFORE UPDATE ON billing_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add Retell Agent IDs to billing_customers table
-- Each customer can have multiple agent IDs (for different agents/phone numbers)

ALTER TABLE billing_customers
ADD COLUMN retell_agent_ids TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN billing_customers.retell_agent_ids IS
'Array of Retell AI agent IDs associated with this customer. Used to filter chats/calls for billing calculations.';

-- Create index for faster lookups when filtering by agent ID
CREATE INDEX idx_billing_customers_retell_agent_ids ON billing_customers USING GIN (retell_agent_ids);
-- Add Retell API configuration to billing_settings

ALTER TABLE billing_settings
ADD COLUMN retell_api_key_encrypted TEXT,
ADD COLUMN retell_api_enabled BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN billing_settings.retell_api_key_encrypted IS
'Encrypted Retell AI API key for fetching call/chat data and costs';

COMMENT ON COLUMN billing_settings.retell_api_enabled IS
'Whether to use Retell AI API for cost calculations (vs manual import)';
-- Add Twilio API configuration to billing_settings

ALTER TABLE billing_settings
ADD COLUMN twilio_account_sid_encrypted TEXT,
ADD COLUMN twilio_auth_token_encrypted TEXT,
ADD COLUMN twilio_api_enabled BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN billing_settings.twilio_account_sid_encrypted IS
'Encrypted Twilio Account SID for fetching usage data and costs';

COMMENT ON COLUMN billing_settings.twilio_auth_token_encrypted IS
'Encrypted Twilio Auth Token for API authentication';

COMMENT ON COLUMN billing_settings.twilio_api_enabled IS
'Whether to use Twilio API for cost calculations (vs manual import)';
-- Add user management and MFA support for billing system

-- Create billing_users table to track authorized users
CREATE TABLE IF NOT EXISTS billing_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  is_active BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES billing_users(id)
);

-- Create index for faster lookups
CREATE INDEX idx_billing_users_auth_user_id ON billing_users(auth_user_id);
CREATE INDEX idx_billing_users_email ON billing_users(email);
CREATE INDEX idx_billing_users_role ON billing_users(role);

-- Enable RLS
ALTER TABLE billing_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_users
-- Super admins can see all users
CREATE POLICY "Super admins can view all users"
  ON billing_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM billing_users bu
      WHERE bu.auth_user_id = auth.uid()
      AND bu.role = 'super_admin'
      AND bu.is_active = true
    )
  );

-- Super admins can insert new users
CREATE POLICY "Super admins can insert users"
  ON billing_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM billing_users bu
      WHERE bu.auth_user_id = auth.uid()
      AND bu.role = 'super_admin'
      AND bu.is_active = true
    )
  );

-- Super admins can update users
CREATE POLICY "Super admins can update users"
  ON billing_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM billing_users bu
      WHERE bu.auth_user_id = auth.uid()
      AND bu.role = 'super_admin'
      AND bu.is_active = true
    )
  );

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON billing_users FOR SELECT
  USING (auth_user_id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update their own profile"
  ON billing_users FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid() AND
    role = (SELECT role FROM billing_users WHERE auth_user_id = auth.uid())
  );

-- Create login_history table to track login attempts
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_user_id UUID REFERENCES billing_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  login_successful BOOLEAN NOT NULL,
  mfa_verified BOOLEAN,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for login history
CREATE INDEX idx_login_history_user ON login_history(billing_user_id);
CREATE INDEX idx_login_history_email ON login_history(email);
CREATE INDEX idx_login_history_created_at ON login_history(created_at DESC);

-- Enable RLS
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_history
-- Super admins can view all login history
CREATE POLICY "Super admins can view all login history"
  ON login_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM billing_users bu
      WHERE bu.auth_user_id = auth.uid()
      AND bu.role = 'super_admin'
      AND bu.is_active = true
    )
  );

-- Users can view their own login history
CREATE POLICY "Users can view their own login history"
  ON login_history FOR SELECT
  USING (
    billing_user_id IN (
      SELECT id FROM billing_users WHERE auth_user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for billing_users
CREATE TRIGGER update_billing_users_updated_at
  BEFORE UPDATE ON billing_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE billing_users IS 'Authorized users for the billing system with MFA support';
COMMENT ON TABLE login_history IS 'Login attempt history for security auditing';

COMMENT ON COLUMN billing_users.role IS 'User role: super_admin (full access, can manage users) or admin (read/write billing data)';
COMMENT ON COLUMN billing_users.mfa_enabled IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN billing_users.mfa_secret IS 'Encrypted TOTP secret for MFA';
-- Create a demo user for testing
-- This creates a Super Admin user with email: demo@nexasync.com / password: Demo123456!

-- NOTE: You need to create this user in Supabase Auth first via the Supabase Dashboard
-- Then run this SQL to create the billing_users record

-- Instructions:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" and create:
--    Email: demo@nexasync.com
--    Password: Demo123456!
--    Confirm password: true
-- 3. Copy the user's UUID from the dashboard
-- 4. Replace 'YOUR_AUTH_USER_ID_HERE' below with the actual UUID
-- 5. Run this SQL

-- Example (replace with your actual auth user ID):
INSERT INTO billing_users (
  auth_user_id,
  email,
  full_name,
  role,
  is_active,
  mfa_enabled,
  mfa_secret,
  created_at,
  updated_at
) VALUES (
  'YOUR_AUTH_USER_ID_HERE'::uuid,  -- Replace this with actual UUID from Supabase Auth
  'demo@nexasync.com',
  'Demo Super Admin',
  'super_admin',
  true,
  false,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Create a second demo user (Regular Admin)
-- Follow the same steps above for:
-- Email: admin@nexasync.com
-- Password: Admin123456!

INSERT INTO billing_users (
  auth_user_id,
  email,
  full_name,
  role,
  is_active,
  mfa_enabled,
  mfa_secret,
  created_at,
  updated_at
) VALUES (
  'YOUR_SECOND_AUTH_USER_ID_HERE'::uuid,  -- Replace this with actual UUID from Supabase Auth
  'admin@nexasync.com',
  'Demo Admin User',
  'admin',
  true,
  false,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Add comments
COMMENT ON TABLE billing_users IS 'Demo users created: demo@nexasync.com (super_admin) and admin@nexasync.com (admin)';
-- Add Retell API key column to billing_customers table
-- This allows each customer to have their own Retell AI API key

ALTER TABLE billing_customers
ADD COLUMN retell_api_key_encrypted TEXT;

-- Add comment for documentation
COMMENT ON COLUMN billing_customers.retell_api_key_encrypted IS
'Encrypted Retell AI API key specific to this customer. Used to fetch their call/chat data and costs.';

-- Create index for customers with API keys enabled
CREATE INDEX idx_billing_customers_has_retell_key ON billing_customers ((retell_api_key_encrypted IS NOT NULL));
-- Add per-customer auto-invoice scheduling columns
ALTER TABLE billing_customers
ADD COLUMN IF NOT EXISTS auto_invoice_day_of_month INTEGER,
ADD COLUMN IF NOT EXISTS auto_invoice_time TEXT,
ADD COLUMN IF NOT EXISTS auto_send_invoice BOOLEAN DEFAULT false;

-- Set default values for existing records
UPDATE billing_customers
SET auto_invoice_day_of_month = 1,
    auto_invoice_time = '09:00',
    auto_send_invoice = false
WHERE auto_invoice_day_of_month IS NULL;

-- Add constraint to validate day of month (1-28)
ALTER TABLE billing_customers
ADD CONSTRAINT valid_auto_invoice_day
CHECK (auto_invoice_day_of_month IS NULL OR (auto_invoice_day_of_month >= 1 AND auto_invoice_day_of_month <= 28));

-- Add comment to explain the columns
COMMENT ON COLUMN billing_customers.auto_invoice_day_of_month IS 'Day of month (1-28) when invoices should be auto-generated for this customer';
COMMENT ON COLUMN billing_customers.auto_invoice_time IS 'Time (HH:MM in 24h format) when invoices should be auto-generated';
COMMENT ON COLUMN billing_customers.auto_send_invoice IS 'Whether to automatically send invoices or create as draft';
