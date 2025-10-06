-- Find the billing_users record by email
SELECT id, auth_user_id, email, full_name, role, is_active, mfa_enabled, created_at
FROM public.billing_users
WHERE email = 'elitesquadp@protonmail.com';
