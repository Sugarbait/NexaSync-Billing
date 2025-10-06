-- Update the billing_users record to point to the correct auth_user_id
UPDATE public.billing_users
SET
  auth_user_id = 'c4b2b868-b76b-46c4-abcf-f65027e9f64c',
  updated_at = NOW()
WHERE email = 'elitesquadp@protonmail.com';

-- Verify the update
SELECT id, auth_user_id, email, full_name, role, is_active, mfa_enabled, created_at
FROM public.billing_users
WHERE email = 'elitesquadp@protonmail.com';
