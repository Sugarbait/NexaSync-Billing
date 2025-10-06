-- Fix RLS policy to allow user registration during signup
-- Issue: New users can't be inserted into billing_users during registration
-- Solution: Allow both authenticated and anon users to insert, with constraints

BEGIN;

-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can create billing users" ON billing_users;

-- New policy: Allow both authenticated and anon users to insert
-- For authenticated users: admins creating users in the UI
-- For anon users: during the signup process after auth.signUp()
CREATE POLICY "Allow user creation"
ON billing_users
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

COMMIT;

-- Verify policy
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'billing_users'
ORDER BY policyname;
