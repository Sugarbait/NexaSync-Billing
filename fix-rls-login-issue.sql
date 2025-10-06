-- Fix RLS policies to allow login while still protecting data

BEGIN;

-- Drop all existing policies
DROP POLICY IF EXISTS "service_role_full_access" ON public.billing_users;
DROP POLICY IF EXISTS "authenticated_read_own" ON public.billing_users;
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

-- Users can always read their own record (needed for login)
CREATE POLICY "users_read_own"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- Super admins can read ALL users (including pending)
CREATE POLICY "super_admin_read_all"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.billing_users
            WHERE auth_user_id = auth.uid()
            AND role = 'super_admin'
            AND is_active = true
        )
    );

-- Super admins can update all users
CREATE POLICY "super_admin_update_all"
    ON public.billing_users
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.billing_users
            WHERE auth_user_id = auth.uid()
            AND role = 'super_admin'
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.billing_users
            WHERE auth_user_id = auth.uid()
            AND role = 'super_admin'
            AND is_active = true
        )
    );

-- Super admins can delete users
CREATE POLICY "super_admin_delete_all"
    ON public.billing_users
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.billing_users
            WHERE auth_user_id = auth.uid()
            AND role = 'super_admin'
            AND is_active = true
        )
    );

COMMIT;

SELECT 'RLS policies fixed - you can now log in!' as status;
