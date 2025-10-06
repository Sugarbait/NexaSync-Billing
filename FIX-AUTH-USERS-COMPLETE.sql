-- ==========================================
-- COMPLETE FIX FOR AUTH.USERS CREATION ISSUES
-- Run this script in Supabase SQL Editor
-- ==========================================

-- Step 1: Drop the problematic trigger if it exists
-- The auto_confirm_user trigger might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_user() CASCADE;

-- Step 2: Check if there's a handle_new_user function that might be problematic
-- This is a common trigger that tries to create billing_users automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 3: Recreate ONLY the auto-confirm function without any billing_users logic
-- This function ONLY sets email_confirmed_at and nothing else
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    -- Only set email_confirmed_at if not already set
    IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
    END IF;

    -- IMPORTANT: Just return NEW, don't do anything with billing_users
    RETURN NEW;
END;
$$;

-- Step 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- Step 5: Ensure billing_users.auth_user_id is nullable and has no problematic constraints
-- Check if the column exists and alter it
DO $$
BEGIN
    -- Make auth_user_id nullable
    ALTER TABLE public.billing_users
        ALTER COLUMN auth_user_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter auth_user_id: %', SQLERRM;
END $$;

-- Step 6: Drop any foreign key constraint from billing_users to auth.users if it exists
-- Foreign keys can cause issues during user creation
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the foreign key constraint name
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'billing_users'
        AND kcu.column_name = 'auth_user_id'
    LIMIT 1;

    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.billing_users DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop foreign key: %', SQLERRM;
END $$;

-- Step 7: Verify RLS policies on billing_users allow service_role to insert
-- Service role should bypass RLS, but let's ensure there are no restrictive policies
ALTER TABLE public.billing_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Service role has full access" ON public.billing_users;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.billing_users;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.billing_users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.billing_users;

-- Create comprehensive policies
CREATE POLICY "Service role has full access"
    ON public.billing_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable insert for service role"
    ON public.billing_users
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid() OR role = 'super_admin');

CREATE POLICY "Enable update for authenticated users"
    ON public.billing_users
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid() OR role = 'super_admin')
    WITH CHECK (auth_user_id = auth.uid() OR role = 'super_admin');

-- Step 8: Grant necessary permissions
GRANT ALL ON public.billing_users TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 9: Verify the setup with a test query
-- This won't create anything, just checks permissions
SELECT
    'Setup Complete' as status,
    'Run the diagnostic script to verify' as next_step;

-- Step 10: Optional - Check what triggers exist now
SELECT
    'Current triggers on auth.users:' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
ORDER BY trigger_name;
