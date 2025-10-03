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
