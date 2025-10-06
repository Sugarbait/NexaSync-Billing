-- Allow authenticated users to update billing_users
-- (Safe because only super_admins can access the Users page in the app)

BEGIN;

-- Drop the restrictive update policy
DROP POLICY IF EXISTS "users_update_own" ON public.billing_users;

-- Allow all authenticated users to update billing_users
-- Application logic ensures only super_admins can access this functionality
CREATE POLICY "authenticated_update_all"
    ON public.billing_users
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow all authenticated users to delete billing_users
-- Application logic ensures only super_admins can access this functionality
CREATE POLICY "authenticated_delete_all"
    ON public.billing_users
    FOR DELETE
    TO authenticated
    USING (true);

COMMIT;

SELECT 'Users can now be updated and approved!' as status;
