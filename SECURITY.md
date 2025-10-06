# Security Policy

## ⚠️ Security-Critical Files

The following files contain security-critical code and **MUST NOT** be modified without authorization from elitesquadp@protonmail.com:

### Authentication & MFA
- **`app/login/page.tsx`** - Login authentication and MFA verification
  - MFA enforcement logic
  - Session verification
  - Bypass prevention mechanisms

- **`app/admin/billing/layout.tsx`** - Route-level security
  - MFA verification checks on page load
  - User isolation enforcement
  - Session management

- **`lib/services/mfaService.ts`** - MFA cryptographic operations
  - TOTP token generation and verification
  - Secret encryption/decryption
  - QR code generation

### Database Security
- **SQL Migration Files** (all `*.sql` files)
  - `auto-confirm-users.sql` - Auto-confirmation trigger
  - `fix-pierre-auth-user-id.sql` - User ID fixes
  - Any files modifying auth or billing_users tables

## Security Features

### 1. Multi-Factor Authentication (MFA)
- Required for all super_admin users
- TOTP-based (Google Authenticator compatible)
- Cannot be bypassed via session manipulation
- Verified on every page load

### 2. User Isolation
- Only users in `billing_users` table can access the system
- Auth users without billing_users records are denied access
- No cross-contamination with other applications

### 3. Session Management
- MFA verification stored in sessionStorage
- Sessions cleared on logout
- Automatic logout if MFA required but not verified

### 4. Database Triggers
- Auto-confirmation of new users
- Email verification enforcement
- Row-level security policies (if enabled)

## Modification Authorization

### To Request Changes
1. Contact: elitesquadp@protonmail.com
2. Provide detailed explanation of changes needed
3. Wait for explicit authorization before proceeding
4. Document all changes in git commit messages

### Prohibited Actions
- ❌ Disabling MFA enforcement
- ❌ Bypassing authentication checks
- ❌ Removing session verification
- ❌ Modifying user isolation logic
- ❌ Altering cryptographic operations
- ❌ Changing database triggers without testing

## Incident Response

If you suspect a security vulnerability:
1. **DO NOT** create a public issue
2. Email: elitesquadp@protonmail.com immediately
3. Include detailed description and steps to reproduce
4. Wait for response before disclosing

## Version Control

All security-critical files are tracked in git. Any modifications will be:
- Visible in commit history
- Subject to code review
- Tested in isolated environment before deployment

## Security Contact

- **Primary Contact**: elitesquadp@protonmail.com
- **Role**: Super Admin / Security Owner
- **Response Time**: Within 24 hours for critical issues
