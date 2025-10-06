-- Remove the foreign key constraint on auth_user_id
-- This allows us to store auth user IDs without the constraint failing
ALTER TABLE billing_users DROP CONSTRAINT IF EXISTS billing_users_auth_user_id_fkey;

-- Make auth_user_id nullable so it's optional
ALTER TABLE billing_users ALTER COLUMN auth_user_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN billing_users.auth_user_id IS 'Optional reference to Supabase auth.users - stored for reference but not enforced';
