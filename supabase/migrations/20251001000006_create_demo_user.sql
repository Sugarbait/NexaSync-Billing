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
