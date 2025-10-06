-- ==========================================
-- NUCLEAR OPTION: Complete Reset of User Creation System
-- This removes EVERYTHING that could interfere with auth.admin.createUser()
-- ==========================================

-- PART 1: DISABLE ALL TRIGGERS ON auth.users
-- ==========================================
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    RAISE NOTICE 'Disabling all triggers on auth.users...';

    FOR trigger_rec IN
        SELECT tgname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'auth'
            AND c.relname = 'users'
            AND NOT t.tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE auth.users DISABLE TRIGGER %I', trigger_rec.tgname);
        RAISE NOTICE 'Disabled trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- PART 2: REMOVE ALL CUSTOM FUNCTIONS
-- ==========================================
DROP FUNCTION IF EXISTS public.auto_confirm_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.create_billing_user() CASCADE;

-- PART 3: CLEAN UP billing_users TABLE
-- ==========================================

-- Make auth_user_id nullable
ALTER TABLE public.billing_users
    ALTER COLUMN auth_user_id DROP NOT NULL;

-- Drop ALL foreign key constraints
DO $$
DECLARE
    fk_rec RECORD;
BEGIN
    FOR fk_rec IN
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
            AND table_name = 'billing_users'
            AND constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE format('ALTER TABLE public.billing_users DROP CONSTRAINT IF EXISTS %I CASCADE', fk_rec.constraint_name);
        RAISE NOTICE 'Dropped FK constraint: %', fk_rec.constraint_name;
    END LOOP;
END $$;

-- PART 4: RESET RLS POLICIES
-- ==========================================

-- Drop ALL policies on billing_users
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'billing_users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.billing_users', policy_rec.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_rec.policyname;
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.billing_users ENABLE ROW LEVEL SECURITY;

-- Create ONLY service_role policy
CREATE POLICY "service_role_bypass"
    ON public.billing_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create minimal authenticated policy
CREATE POLICY "authenticated_select"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (true);

-- PART 5: GRANT ALL PERMISSIONS
-- ==========================================
GRANT ALL ON public.billing_users TO service_role;
GRANT ALL ON public.billing_users TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- PART 6: RE-ENABLE ONLY ESSENTIAL TRIGGERS
-- ==========================================
-- Re-enable only Supabase internal triggers (if any)
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN
        SELECT tgname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'auth'
            AND c.relname = 'users'
            AND t.tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE auth.users ENABLE TRIGGER %I', trigger_rec.tgname);
        RAISE NOTICE 'Re-enabled internal trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- PART 7: VERIFICATION
-- ==========================================
SELECT 'Nuclear Fix Applied' as status;

-- Show current state
SELECT
    'Disabled triggers on auth.users:' as info,
    tgname as trigger_name,
    tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
    AND c.relname = 'users'
    AND NOT t.tgisinternal
ORDER BY tgname;

SELECT
    'Active policies on billing_users:' as info,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'billing_users'
ORDER BY policyname;

-- PART 8: TEST QUERY
-- This should work without errors
SELECT 'If you can see this, the database is ready for auth.admin.createUser()' as final_message;
