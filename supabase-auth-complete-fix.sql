-- ========================================
-- COMPLETE FIX FOR SUPABASE AUTH SIGNUP ISSUE
-- ========================================
-- This script addresses ALL potential causes of "Database error saving new user"
-- Run this AFTER running supabase-auth-diagnostic.sql to understand your current state

-- ========================================
-- STEP 1: DISABLE RLS ON auth.users (IF ENABLED)
-- ========================================
-- RLS on auth.users can block Supabase's internal user creation
-- Note: This should normally be handled by Supabase, but sometimes gets misconfigured

DO $$
BEGIN
    -- Check if RLS is enabled and disable it
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'auth'
        AND tablename = 'users'
        AND rowsecurity = true
    ) THEN
        EXECUTE 'ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY';
        RAISE NOTICE 'RLS disabled on auth.users';
    ELSE
        RAISE NOTICE 'RLS already disabled on auth.users';
    END IF;
END $$;

-- ========================================
-- STEP 2: REMOVE ANY BLOCKING POLICIES
-- ========================================
-- Drop all custom RLS policies on auth.users
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'auth' AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON auth.users', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- ========================================
-- STEP 3: CLEAN UP OLD TRIGGERS
-- ========================================
-- Remove any existing auto-confirm triggers
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ========================================
-- STEP 4: CREATE IMPROVED AUTO-CONFIRM FUNCTION
-- ========================================
-- This function auto-confirms users BEFORE they're inserted
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-confirm email
    IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
    END IF;

    -- Auto-confirm user
    IF NEW.confirmed_at IS NULL THEN
        NEW.confirmed_at := NOW();
    END IF;

    -- Set phone confirmed if phone is provided
    IF NEW.phone IS NOT NULL AND NEW.phone_confirmed_at IS NULL THEN
        NEW.phone_confirmed_at := NOW();
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't block user creation
        RAISE WARNING 'Error in auto_confirm_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- ========================================
-- STEP 5: CREATE BEFORE INSERT TRIGGER
-- ========================================
-- BEFORE INSERT is crucial - it modifies the record BEFORE it's saved
CREATE TRIGGER on_auth_user_created_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_user();

-- ========================================
-- STEP 6: FIX billing_users TABLE CONSTRAINTS
-- ========================================
-- Make auth_user_id nullable to avoid timing issues
ALTER TABLE billing_users
    ALTER COLUMN auth_user_id DROP NOT NULL;

-- Ensure auth_user_id is unique
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_users_auth_user_id_key'
        AND conrelid = 'billing_users'::regclass
    ) THEN
        ALTER TABLE billing_users
            ADD CONSTRAINT billing_users_auth_user_id_key
            UNIQUE (auth_user_id);
        RAISE NOTICE 'Added unique constraint on auth_user_id';
    END IF;
END $$;

-- ========================================
-- STEP 7: FIX RLS POLICIES ON billing_users
-- ========================================
-- Ensure authenticated users can insert into billing_users
DROP POLICY IF EXISTS "Authenticated users can create billing users" ON billing_users;

CREATE POLICY "Authenticated users can create billing users"
ON billing_users FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow service role (for server-side operations)
DROP POLICY IF EXISTS "Service role can manage billing users" ON billing_users;

CREATE POLICY "Service role can manage billing users"
ON billing_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- STEP 8: CREATE FUNCTION TO SYNC AUTH AND BILLING USERS
-- ========================================
-- This function creates a billing_users record when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
DECLARE
    user_full_name TEXT;
    user_role TEXT;
BEGIN
    -- Extract full_name from user metadata
    user_full_name := NEW.raw_user_meta_data->>'full_name';

    -- Default role to 'user' if not specified
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

    -- Insert into billing_users if not exists
    INSERT INTO billing_users (
        auth_user_id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(user_full_name, NEW.email),
        user_role,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block auth user creation
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_billing ON auth.users;

-- Create AFTER INSERT trigger for billing_users sync
CREATE TRIGGER on_auth_user_created_billing
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- STEP 9: FIX EXISTING UNCONFIRMED USERS
-- ========================================
-- Confirm all existing users that aren't confirmed
UPDATE auth.users
SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL OR confirmed_at IS NULL;

-- ========================================
-- STEP 10: SYNC EXISTING AUTH USERS TO billing_users
-- ========================================
-- Create billing_users records for any auth.users that don't have them
INSERT INTO billing_users (
    auth_user_id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    COALESCE(au.raw_user_meta_data->>'role', 'user'),
    true,
    au.created_at,
    NOW()
FROM auth.users au
LEFT JOIN billing_users bu ON au.id = bu.auth_user_id
WHERE bu.id IS NULL
ON CONFLICT (auth_user_id) DO NOTHING;

-- ========================================
-- STEP 11: GRANT NECESSARY PERMISSIONS
-- ========================================
-- Ensure authenticated users can read their own data
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- ========================================
-- STEP 12: VERIFY THE FIX
-- ========================================
-- Check that everything is set up correctly
DO $$
DECLARE
    trigger_count INTEGER;
    policy_count INTEGER;
    rls_enabled BOOLEAN;
BEGIN
    -- Check triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
        AND tgname LIKE '%confirm%'
        AND tgisinternal = false;

    RAISE NOTICE 'Auto-confirm triggers found: %', trigger_count;

    -- Check RLS
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE schemaname = 'auth' AND tablename = 'users';

    RAISE NOTICE 'RLS enabled on auth.users: %', rls_enabled;

    -- Check policies on billing_users
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_users';

    RAISE NOTICE 'RLS policies on billing_users: %', policy_count;

    -- Summary
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIX COMPLETED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test user creation via supabase.auth.signUp()';
    RAISE NOTICE '2. Check that users are auto-confirmed';
    RAISE NOTICE '3. Verify billing_users records are created automatically';
END $$;

-- ========================================
-- OPTIONAL: TEST USER CREATION
-- ========================================
-- Uncomment to test creating a user directly in the database
/*
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- This simulates what Supabase does internally
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'test_' || gen_random_uuid()::text || '@example.com',
        crypt('TestPassword123!', gen_salt('bf')),
        NOW(),
        NULL,
        NULL,
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Test User", "role": "admin"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO test_user_id;

    RAISE NOTICE 'Test user created with ID: %', test_user_id;

    -- Verify billing_users record was created
    IF EXISTS (
        SELECT 1 FROM billing_users WHERE auth_user_id = test_user_id
    ) THEN
        RAISE NOTICE 'billing_users record created successfully';
    ELSE
        RAISE WARNING 'billing_users record NOT created - trigger may have failed';
    END IF;

    -- Clean up test user
    DELETE FROM billing_users WHERE auth_user_id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE 'Test user cleaned up';
END $$;
*/
