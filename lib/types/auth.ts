export interface BillingUser {
  id: string
  auth_user_id: string | null
  email: string
  full_name: string
  role: 'super_admin' | 'admin'
  is_active: boolean
  mfa_enabled: boolean
  mfa_secret: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface LoginHistory {
  id: string
  billing_user_id: string
  email: string
  login_successful: boolean
  mfa_verified: boolean | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface MFASetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface MFAVerification {
  token: string
}
