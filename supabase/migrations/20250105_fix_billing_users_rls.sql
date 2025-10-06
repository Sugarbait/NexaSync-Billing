-- Fix RLS policies for billing_users table to allow user creation

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view billing users" ON billing_users;
DROP POLICY IF EXISTS "Admins can manage billing users" ON billing_users;
DROP POLICY IF EXISTS "Super admins can manage billing users" ON billing_users;

-- Enable RLS
ALTER TABLE billing_users ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view billing_users
CREATE POLICY "Authenticated users can view billing users"
ON billing_users
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert billing_users
-- This allows user creation from the admin panel
CREATE POLICY "Authenticated users can create billing users"
ON billing_users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Users can update billing_users
CREATE POLICY "Authenticated users can update billing users"
ON billing_users
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Users can delete billing_users
CREATE POLICY "Authenticated users can delete billing users"
ON billing_users
FOR DELETE
TO authenticated
USING (true);
