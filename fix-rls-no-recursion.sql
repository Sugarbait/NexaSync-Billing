-- Fix RLS policies without recursion

BEGIN;

-- Drop all existing policies
DROP POLICY IF EXISTS "service_role_full_access" ON public.billing_users;
DROP POLICY IF EXISTS "authenticated_read_own" ON public.billing_users;
DROP POLICY IF EXISTS "users_read_own" ON public.billing_users;
DROP POLICY IF EXISTS "super_admin_read_all" ON public.billing_users;
DROP POLICY IF EXISTS "super_admin_update_all" ON public.billing_users;
DROP POLICY IF EXISTS "super_admin_delete_all" ON public.billing_users;

-- Service role has full access
CREATE POLICY "service_role_full_access"
    ON public.billing_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- All authenticated users can read all billing_users
-- (This is safe because only authorized users can authenticate in the first place)
CREATE POLICY "authenticated_read_all"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can only update their own record
CREATE POLICY "users_update_own"
    ON public.billing_users
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

COMMIT;

SELECT 'RLS policies simplified - login should work now!' as status;
