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
