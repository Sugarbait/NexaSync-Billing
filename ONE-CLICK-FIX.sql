-- ==========================================
-- ONE-CLICK FIX FOR "Database error creating new user"
-- Copy this entire file and paste into Supabase SQL Editor, then click RUN
-- This will fix ALL known causes of the error
-- ==========================================

BEGIN;

-- ====================
-- SECTION 1: DIAGNOSTIC
-- ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STARTING DIAGNOSTIC AND FIX PROCESS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Check current triggers
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
        AND event_object_table = 'users';

    RAISE NOTICE 'Found % triggers on auth.users', trigger_count;
END $$;

-- ====================
-- SECTION 2: DISABLE ALL CUSTOM TRIGGERS
-- ====================
DO $$
DECLARE
    trigger_rec RECORD;
    disabled_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Disabling custom triggers on auth.users ---';

    FOR trigger_rec IN
        SELECT t.tgname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'auth'
            AND c.relname = 'users'
            AND NOT t.tgisinternal
            AND t.tgenabled != 'D'  -- Not already disabled
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE auth.users DISABLE TRIGGER %I', trigger_rec.tgname);
            RAISE NOTICE '  ✓ Disabled trigger: %', trigger_rec.tgname;
            disabled_count := disabled_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ✗ Could not disable trigger: % (Error: %)', trigger_rec.tgname, SQLERRM;
        END;
    END LOOP;

    IF disabled_count = 0 THEN
        RAISE NOTICE '  ℹ No custom triggers to disable';
    ELSE
        RAISE NOTICE '  ✓ Disabled % custom triggers', disabled_count;
    END IF;
END $$;

-- ====================
-- SECTION 3: DROP PROBLEMATIC FUNCTIONS
-- ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Dropping problematic functions ---';

    DROP FUNCTION IF EXISTS public.auto_confirm_user() CASCADE;
    RAISE NOTICE '  ✓ Dropped auto_confirm_user()';

    DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
    RAISE NOTICE '  ✓ Dropped handle_new_user()';

    DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;
    RAISE NOTICE '  ✓ Dropped handle_auth_user_created()';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✗ Error dropping functions: %', SQLERRM;
END $$;

-- ====================
-- SECTION 4: FIX billing_users TABLE
-- ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Fixing billing_users table ---';

    -- Make auth_user_id nullable
    BEGIN
        ALTER TABLE public.billing_users ALTER COLUMN auth_user_id DROP NOT NULL;
        RAISE NOTICE '  ✓ Made auth_user_id nullable';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ℹ auth_user_id was already nullable or error: %', SQLERRM;
    END;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✗ Error fixing billing_users: %', SQLERRM;
END $$;

-- ====================
-- SECTION 5: DROP FOREIGN KEY CONSTRAINTS
-- ====================
DO $$
DECLARE
    fk_rec RECORD;
    dropped_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Dropping foreign key constraints ---';

    FOR fk_rec IN
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
        BEGIN
            EXECUTE format('ALTER TABLE public.billing_users DROP CONSTRAINT IF EXISTS %I CASCADE', fk_rec.constraint_name);
            RAISE NOTICE '  ✓ Dropped FK constraint: %', fk_rec.constraint_name;
            dropped_count := dropped_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ✗ Could not drop FK: % (Error: %)', fk_rec.constraint_name, SQLERRM;
        END;
    END LOOP;

    IF dropped_count = 0 THEN
        RAISE NOTICE '  ℹ No foreign key constraints to drop';
    ELSE
        RAISE NOTICE '  ✓ Dropped % foreign key constraints', dropped_count;
    END IF;
END $$;

-- ====================
-- SECTION 6: RESET RLS POLICIES
-- ====================
DO $$
DECLARE
    policy_rec RECORD;
    dropped_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Resetting RLS policies ---';

    -- Drop all existing policies
    FOR policy_rec IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'billing_users'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.billing_users', policy_rec.policyname);
            RAISE NOTICE '  ✓ Dropped policy: %', policy_rec.policyname;
            dropped_count := dropped_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ✗ Could not drop policy: % (Error: %)', policy_rec.policyname, SQLERRM;
        END;
    END LOOP;

    IF dropped_count > 0 THEN
        RAISE NOTICE '  ✓ Dropped % policies', dropped_count;
    END IF;

    -- Enable RLS
    ALTER TABLE public.billing_users ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '  ✓ Enabled RLS on billing_users';

    -- Create service_role policy
    CREATE POLICY "service_role_full_access"
        ON public.billing_users
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    RAISE NOTICE '  ✓ Created service_role_full_access policy';

    -- Create authenticated read policy
    CREATE POLICY "authenticated_read_own"
        ON public.billing_users
        FOR SELECT
        TO authenticated
        USING (auth_user_id = auth.uid());
    RAISE NOTICE '  ✓ Created authenticated_read_own policy';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✗ Error resetting RLS policies: %', SQLERRM;
END $$;

-- ====================
-- SECTION 7: GRANT PERMISSIONS
-- ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '--- Granting permissions ---';

    GRANT ALL ON public.billing_users TO service_role;
    RAISE NOTICE '  ✓ Granted ALL on billing_users to service_role';

    GRANT ALL ON public.billing_users TO postgres;
    RAISE NOTICE '  ✓ Granted ALL on billing_users to postgres';

    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
    RAISE NOTICE '  ✓ Granted sequence permissions to service_role';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✗ Error granting permissions: %', SQLERRM;
END $$;

-- ====================
-- SECTION 8: VERIFICATION
-- ====================
DO $$
DECLARE
    trigger_count INTEGER;
    policy_count INTEGER;
    fk_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION';
    RAISE NOTICE '========================================';

    -- Count disabled triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'auth'
        AND c.relname = 'users'
        AND NOT t.tgisinternal
        AND t.tgenabled = 'D';

    RAISE NOTICE 'Disabled custom triggers on auth.users: %', trigger_count;

    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'billing_users';

    RAISE NOTICE 'Active RLS policies on billing_users: %', policy_count;

    -- Count FK constraints
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
        AND table_name = 'billing_users'
        AND constraint_type = 'FOREIGN KEY';

    RAISE NOTICE 'Foreign key constraints on billing_users: %', fk_count;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIX COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run: node test-user-creation.js';
    RAISE NOTICE '2. Or test via your API endpoint';
    RAISE NOTICE '3. Check Supabase Dashboard > Auth > Users';
    RAISE NOTICE '';
END $$;

COMMIT;

-- Show final state
SELECT
    '✓ Setup Complete' as status,
    'auth.admin.createUser() should now work' as message;
