# Database Setup

## Prerequisites

1. Have a Supabase project created
2. Have Supabase CLI installed (optional for local development)

## Setup Instructions

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open the migration file: `migrations/20251001000001_create_billing_tables.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Run the query

### Option 2: Using Supabase CLI

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Database Schema

### Tables Created

1. **billing_customers** - Stores billing customer information (NO PHI)
2. **invoice_records** - Stores invoice records and history
3. **billing_settings** - Stores billing configuration per user

### Security

- Row Level Security (RLS) is enabled on all tables
- Access requires:
  - Valid authentication
  - Super User role
  - MFA enabled and setup completed

### Notes

- This assumes you have a `user_settings` table with role and MFA fields
- If not, you'll need to adjust the RLS policies accordingly
