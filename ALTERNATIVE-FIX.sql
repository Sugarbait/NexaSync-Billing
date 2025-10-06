-- ==========================================
-- ALTERNATIVE FIX: Remove ALL triggers on auth.users
-- This removes any database-level auto-confirmation
-- and relies purely on the email_confirm parameter in createUser()
-- ==========================================

-- Step 1: Remove ALL triggers on auth.users
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_schema = 'auth'
            AND event_object_table = 'users'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trigger_record.trigger_name);
        RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- Step 2: Remove ALL functions that reference auth.users or billing_users
DROP FUNCTION IF EXISTS public.auto_confirm_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Step 3: Ensure billing_users table is ready
-- Make auth_user_id nullable
ALTER TABLE public.billing_users
    ALTER COLUMN auth_user_id DROP NOT NULL;

-- Step 4: Remove foreign key constraint from billing_users to auth.users
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = 'billing_users'
            AND kcu.column_name = 'auth_user_id'
    LOOP
        EXECUTE format('ALTER TABLE public.billing_users DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Step 5: Set up minimal RLS policies
ALTER TABLE public.billing_users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'billing_users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.billing_users', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Create simple policies
CREATE POLICY "service_role_all_access"
    ON public.billing_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_read_own"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- Step 6: Grant permissions
GRANT ALL ON public.billing_users TO service_role;
GRANT ALL ON public.billing_users TO authenticated;

-- Step 7: Verify setup
SELECT 'Alternative Fix Complete' as status;

-- Show remaining triggers (should be none)
SELECT
    'Remaining triggers on auth.users:' as info,
    COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users';
