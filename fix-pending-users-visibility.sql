-- Fix RLS policies to allow super_admin to see all users including pending ones

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "service_role_full_access" ON public.billing_users;
DROP POLICY IF EXISTS "authenticated_read_own" ON public.billing_users;

-- Recreate service_role policy
CREATE POLICY "service_role_full_access"
    ON public.billing_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read their own record
CREATE POLICY "authenticated_read_own"
    ON public.billing_users
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- Allow super_admin to see ALL users (including pending)
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

-- Allow super_admin to update users
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

-- Allow super_admin to delete users
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

SELECT 'RLS policies updated successfully!' as status;
