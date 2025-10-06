-- Create user_invites table for tracking invitations
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  invited_by UUID REFERENCES billing_users(id),
  invite_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);

-- Disable RLS for now
ALTER TABLE user_invites DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE user_invites IS 'User invitation tracking for signup flow';
