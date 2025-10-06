#!/usr/bin/env node

/**
 * Test script to verify auth.admin.createUser() works
 * Run with: node test-user-creation.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function testUserCreation() {
  console.log('🧪 Testing auth.admin.createUser()...\n')

  // Generate random email to avoid conflicts
  const randomId = Math.random().toString(36).substring(7)
  const testEmail = `test-${randomId}@example.com`
  const testPassword = 'TestPassword123!'
  const testFullName = 'Test User'

  console.log('📧 Creating user:', testEmail)
  console.log('👤 Full name:', testFullName)
  console.log('🔑 Using service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...\n')

  try {
    // Step 1: Create auth user
    console.log('Step 1: Creating auth user...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: testFullName
      }
    })

    if (authError) {
      console.error('❌ AUTH ERROR:', authError)
      console.error('\nError details:')
      console.error('  Message:', authError.message)
      console.error('  Status:', authError.status)
      console.error('  Name:', authError.name)
      process.exit(1)
    }

    if (!authData.user) {
      console.error('❌ No user data returned')
      process.exit(1)
    }

    console.log('✅ Auth user created successfully!')
    console.log('   User ID:', authData.user.id)
    console.log('   Email:', authData.user.email)
    console.log('   Email confirmed:', authData.user.email_confirmed_at ? 'Yes' : 'No')

    // Step 2: Create billing_users record
    console.log('\nStep 2: Creating billing_users record...')
    const { data: billingData, error: billingError } = await supabaseAdmin
      .from('billing_users')
      .insert({
        auth_user_id: authData.user.id,
        email: testEmail,
        full_name: testFullName,
        role: 'admin',
        is_active: true,
        mfa_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (billingError) {
      console.error('❌ BILLING USER ERROR:', billingError)
      console.error('\nError details:')
      console.error('  Message:', billingError.message)
      console.error('  Code:', billingError.code)
      console.error('  Details:', billingError.details)

      // Cleanup: Delete auth user
      console.log('\n🧹 Cleaning up auth user...')
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      process.exit(1)
    }

    console.log('✅ Billing user created successfully!')
    console.log('   Billing ID:', billingData.id)
    console.log('   Role:', billingData.role)
    console.log('   Active:', billingData.is_active)

    // Step 3: Cleanup (optional)
    console.log('\n🧹 Cleaning up test user...')
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    console.log('✅ Cleanup complete')

    console.log('\n🎉 SUCCESS! User creation is working correctly!')
    console.log('✅ You can now create users through your API')

  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error)
    console.error('\nStack trace:')
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the test
testUserCreation()
