-- Simple Schema for NexaSync Billing (RLS disabled for initial setup)

-- Create billing_customers table
CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  retell_agent_ids TEXT[] DEFAULT '{}',
  voice_agent_id TEXT,
  sms_agent_id TEXT,
  retell_api_key_encrypted TEXT,
  twilio_account_sid_encrypted TEXT,
  twilio_auth_token_encrypted TEXT,
  twilio_phone_numbers TEXT[] DEFAULT '{}',
  vonage_phone_numbers TEXT[] DEFAULT '{}',
  markup_percentage DECIMAL DEFAULT 0,
  auto_invoice_enabled BOOLEAN DEFAULT false,
  auto_invoice_day_of_month INTEGER,
  auto_invoice_time TEXT,
  auto_send_invoice BOOLEAN DEFAULT false,
  billing_contact_name TEXT,
  billing_address TEXT,
  phone_number TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  notes TEXT,

  CONSTRAINT valid_markup CHECK (markup_percentage >= 0 AND markup_percentage <= 10000),
  CONSTRAINT valid_auto_invoice_day CHECK (auto_invoice_day_of_month IS NULL OR (auto_invoice_day_of_month >= 1 AND auto_invoice_day_of_month <= 28))
);

-- Create invoice_records table
CREATE TABLE IF NOT EXISTS invoice_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_customer_id UUID REFERENCES billing_customers(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_chats INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_sms_segments INTEGER DEFAULT 0,
  total_call_minutes DECIMAL DEFAULT 0,
  twilio_sms_cost_cad DECIMAL NOT NULL DEFAULT 0,
  twilio_voice_cost_cad DECIMAL NOT NULL DEFAULT 0,
  retell_ai_chat_cost_cad DECIMAL NOT NULL DEFAULT 0,
  retell_ai_voice_cost_cad DECIMAL NOT NULL DEFAULT 0,
  subtotal_cad DECIMAL NOT NULL,
  markup_amount_cad DECIMAL DEFAULT 0,
  total_amount_cad DECIMAL NOT NULL,
  invoice_status TEXT DEFAULT 'draft',
  stripe_invoice_url TEXT,
  stripe_invoice_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_date DATE,
  created_by UUID,

  CONSTRAINT valid_status CHECK (
    invoice_status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')
  ),
  CONSTRAINT valid_period CHECK (billing_period_end >= billing_period_start)
);

-- Create billing_settings table
CREATE TABLE IF NOT EXISTS billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  stripe_api_key_encrypted TEXT,
  stripe_publishable_key TEXT,
  stripe_test_mode BOOLEAN DEFAULT true,
  retell_api_key_encrypted TEXT,
  retell_api_enabled BOOLEAN DEFAULT false,
  twilio_account_sid_encrypted TEXT,
  twilio_auth_token_encrypted TEXT,
  twilio_api_enabled BOOLEAN DEFAULT false,
  vonage_api_key_encrypted TEXT,
  vonage_api_secret_encrypted TEXT,
  vonage_api_enabled BOOLEAN DEFAULT false,
  default_markup_percentage DECIMAL DEFAULT 0,
  default_due_date_days INTEGER DEFAULT 30,
  default_invoice_note TEXT,
  invoice_footer_text TEXT,
  auto_invoice_enabled BOOLEAN DEFAULT false,
  auto_invoice_day_of_month INTEGER DEFAULT 1,
  auto_invoice_time TEXT DEFAULT '00:00',
  auto_send_invoices BOOLEAN DEFAULT false,
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

-- Create billing_users table
CREATE TABLE IF NOT EXISTS billing_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
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

-- Create login_history table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_customers_email ON billing_customers(customer_email);
CREATE INDEX IF NOT EXISTS idx_billing_customers_stripe_id ON billing_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_customer_id ON invoice_records(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_period_start ON invoice_records(billing_period_start);
CREATE INDEX IF NOT EXISTS idx_invoice_records_status ON invoice_records(invoice_status);
CREATE INDEX IF NOT EXISTS idx_invoice_records_stripe_id ON invoice_records(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_users_auth_user_id ON billing_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_billing_users_email ON billing_users(email);
CREATE INDEX IF NOT EXISTS idx_billing_users_role ON billing_users(role);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(billing_user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);

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

CREATE TRIGGER update_billing_users_updated_at
  BEFORE UPDATE ON billing_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for now (you can enable it later after adding proper policies)
ALTER TABLE billing_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE login_history DISABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE billing_customers IS 'Customer information and configuration for billing';
COMMENT ON TABLE invoice_records IS 'Invoice records with cost breakdown';
COMMENT ON TABLE billing_settings IS 'Global billing system settings and API keys';
COMMENT ON TABLE billing_users IS 'Authorized users for the billing system with MFA support';
COMMENT ON TABLE login_history IS 'Login attempt history for security auditing';
COMMENT ON COLUMN billing_users.auth_user_id IS 'Optional reference to Supabase auth.users - stored for reference but not enforced';
