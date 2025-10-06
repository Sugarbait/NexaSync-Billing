import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create admin client with service role key (server-side only!)
// IMPORTANT: Never expose the service role key to the client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    // Parse request body first
    const body = await request.json()
    const { email, password, full_name, role, mfa_enabled, is_active } = body

    // Get authorization header
    const authHeader = request.headers.get('authorization')

    let isAdminRequest = false
    let createdBy: string | null = null

    // If authorization header exists, verify it's a super admin
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')

      // Verify the requesting user's session
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
      if (userError || !user) {
        return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
      }

      // Check if requesting user is a super admin
      const { data: billingUser, error: billingUserError } = await supabaseAdmin
        .from('billing_users')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single()

      if (billingUserError || !billingUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 403 })
      }

      if (billingUser.role !== 'super_admin' || !billingUser.is_active) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }

      isAdminRequest = true
      createdBy = user.id
    }

    // For public signup (no auth header), force is_active: false and role: admin
    const finalIsActive = isAdminRequest ? (is_active !== false) : false
    const finalRole = isAdminRequest ? role : 'admin'

    // Validate input
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, full_name' },
        { status: 400 }
      )
    }

    if (isAdminRequest && role && !['admin', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "super_admin"' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Create user in auth.users using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm users created by admins
      user_metadata: {
        full_name
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: `Failed to create auth user: ${authError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Auth user created but no user data returned' },
        { status: 500 }
      )
    }

    // Create billing_users record
    const { data: newBillingUser, error: billingError } = await supabaseAdmin
      .from('billing_users')
      .insert({
        auth_user_id: authData.user.id,
        email,
        full_name,
        role: finalRole,
        is_active: finalIsActive,
        mfa_enabled: mfa_enabled || false,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (billingError) {
      console.error('Billing user creation error:', billingError)

      // Rollback: Delete the auth user we just created
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error('Failed to rollback auth user:', deleteError)
      }

      return NextResponse.json(
        { error: `Failed to create billing user: ${billingError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: newBillingUser,
      message: 'User created successfully'
    })
  } catch (error) {
    console.error('Unexpected error in create-user API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
