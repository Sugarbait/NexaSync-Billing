-- Create billing_users record for elitesquadp@protonmail.com
INSERT INTO public.billing_users (
  auth_user_id,
  email,
  full_name,
  role,
  is_active,
  mfa_enabled,
  created_at,
  updated_at
)
VALUES (
  'c4b2b868-b76b-46c4-abcf-f65027e9f64c',
  'elitesquadp@protonmail.com',
  'Pierre',
  'super_admin',
  true,
  false,
  NOW(),
  NOW()
);

-- Verify the record was created
SELECT id, auth_user_id, email, full_name, role, is_active, mfa_enabled, created_at
FROM public.billing_users
WHERE auth_user_id = 'c4b2b868-b76b-46c4-abcf-f65027e9f64c';
