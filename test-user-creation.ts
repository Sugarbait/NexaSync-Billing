/**
 * Test User Creation and Authentication
 *
 * This script tests the user creation and authentication flow
 * to identify any issues with the Supabase setup.
 *
 * Run this with: npx ts-node test-user-creation.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface TestUser {
  email: string
  password: string
  full_name: string
}

const testUser: TestUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  full_name: 'Test User'
}

async function testUserCreation() {
  console.log('🔧 Starting Supabase Authentication Test\n')

  try {
    // Test 1: Create a new user
    console.log('📝 Test 1: Creating new user...')
    console.log('Email:', testUser.email)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          full_name: testUser.full_name
        }
      }
    })

    if (signUpError) {
      console.error('❌ Sign up error:', signUpError.message)
      return
    }

    if (!signUpData.user) {
      console.error('❌ No user data returned from sign up')
      return
    }

    console.log('✅ User created successfully')
    console.log('User ID:', signUpData.user.id)
    console.log('Email confirmed:', signUpData.user.email_confirmed_at ? 'Yes' : 'No')
    console.log('Session created:', signUpData.session ? 'Yes' : 'No')
    console.log('')

    // Test 2: Check if user exists in auth.users
    console.log('📝 Test 2: Checking auth.users table...')

    const { data: authUserData, error: authUserError } = await supabase
      .from('auth.users')
      .select('*')
      .eq('id', signUpData.user.id)
      .single()

    if (authUserError) {
      console.log('⚠️  Cannot query auth.users directly (expected with anon key)')
    }
    console.log('')

    // Test 3: Create billing_users record
    console.log('📝 Test 3: Creating billing_users record...')

    const { error: billingUserError } = await supabase
      .from('billing_users')
      .insert({
        auth_user_id: signUpData.user.id,
        email: testUser.email,
        full_name: testUser.full_name,
        role: 'admin',
        is_active: true
      })

    if (billingUserError) {
      console.error('❌ Billing user creation error:', billingUserError.message)
      return
    }

    console.log('✅ Billing user created successfully')
    console.log('')

    // Test 4: Try to sign in immediately
    console.log('📝 Test 4: Attempting to sign in...')

    // First, sign out any existing session
    await supabase.auth.signOut()

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    })

    if (signInError) {
      console.error('❌ Sign in error:', signInError.message)
      console.log('\n🔍 This is likely the issue! The error message is:', signInError.message)

      if (signInError.message.includes('Invalid login credentials')) {
        console.log('\n💡 Diagnosis: Email confirmation is required but not set')
        console.log('   The trigger may not be working correctly.')
      }
      return
    }

    console.log('✅ Sign in successful!')
    console.log('User ID:', signInData.user?.id)
    console.log('Session valid:', signInData.session ? 'Yes' : 'No')
    console.log('')

    // Test 5: Verify billing_users record exists and is active
    console.log('📝 Test 5: Verifying billing_users record...')

    const { data: billingUser, error: billingUserQueryError } = await supabase
      .from('billing_users')
      .select('*')
      .eq('auth_user_id', signUpData.user.id)
      .single()

    if (billingUserQueryError) {
      console.error('❌ Billing user query error:', billingUserQueryError.message)
      return
    }

    console.log('✅ Billing user found')
    console.log('Active:', billingUser.is_active)
    console.log('Role:', billingUser.role)
    console.log('MFA enabled:', billingUser.mfa_enabled)
    console.log('')

    console.log('✅ All tests passed! Authentication is working correctly.')

    // Cleanup
    console.log('\n🧹 Cleaning up test user...')
    await supabase.from('billing_users').delete().eq('id', billingUser.id)
    console.log('✅ Test user removed from billing_users')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

async function checkExistingUsers() {
  console.log('\n📊 Checking existing users in billing_users table...\n')

  const { data: users, error } = await supabase
    .from('billing_users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error.message)
    return
  }

  if (users && users.length > 0) {
    console.log(`Found ${users.length} user(s):\n`)
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.full_name} (${user.email})`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Auth ID: ${user.auth_user_id}`)
      console.log(`   Active: ${user.is_active}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   MFA: ${user.mfa_enabled}`)
      console.log('')
    })
  } else {
    console.log('No users found in billing_users table')
  }
}

// Run the tests
async function main() {
  await checkExistingUsers()
  await testUserCreation()
}

main()
