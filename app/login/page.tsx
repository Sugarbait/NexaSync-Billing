'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DollarSign, Shield, Key } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { mfaService } from '@/lib/services/mfaService'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showMFA, setShowMFA] = useState(false)
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
  const [mfaToken, setMfaToken] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Check for demo login
      if (credentials.email === 'demo@nexasync.com' && credentials.password === 'demo123') {
        // Store demo mode in localStorage
        localStorage.setItem('demo_mode', 'true')
        localStorage.setItem('demo_user', JSON.stringify({
          email: 'demo@nexasync.com',
          name: 'Demo User',
          role: 'admin'
        }))

        // Redirect to dashboard
        router.push('/admin/billing')
        return
      }

      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Login failed')
      }

      // Check if user exists in billing_users
      const { data: billingUser, error: userError } = await supabase
        .from('billing_users')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single()

      if (userError || !billingUser) {
        await supabase.auth.signOut()
        throw new Error('User not authorized for billing system')
      }

      if (!billingUser.is_active) {
        await supabase.auth.signOut()
        throw new Error('User account is inactive')
      }

      // Check if MFA is required
      if (billingUser.mfa_enabled) {
        setShowMFA(true)
        setLoading(false)
        return
      }

      // Update last login
      await supabase
        .from('billing_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', billingUser.id)

      // Log login attempt
      await supabase
        .from('login_history')
        .insert({
          billing_user_id: billingUser.id,
          email: credentials.email,
          login_successful: true,
          mfa_verified: false
        })

      // Redirect to dashboard
      router.push('/admin/billing')
    } catch (error) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : 'Login failed')
      setLoading(false)
    }
  }

  async function handleMFAVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!/^\d{6}$/.test(mfaToken)) {
        throw new Error('Invalid MFA code format. Please enter 6 digits.')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: billingUser } = await supabase
        .from('billing_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!billingUser) throw new Error('User not found')

      // Verify TOTP token
      if (billingUser.mfa_secret) {
        const decryptedSecret = mfaService.decryptSecret(billingUser.mfa_secret)
        const isValid = mfaService.verifyToken(mfaToken, decryptedSecret)

        if (!isValid) {
          throw new Error('Invalid MFA code. Please try again.')
        }
      } else {
        throw new Error('MFA not properly configured for this user')
      }

      // Update last login
      await supabase
        .from('billing_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', billingUser.id)

      // Log login attempt
      await supabase
        .from('login_history')
        .insert({
          billing_user_id: billingUser.id,
          email: credentials.email,
          login_successful: true,
          mfa_verified: true
        })

      // Redirect to dashboard
      router.push('/admin/billing')
    } catch (error) {
      console.error('MFA verification error:', error)
      setError(error instanceof Error ? error.message : 'MFA verification failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="https://nexasync.ca/images/NexaSync-White.png"
              alt="NexaSync Logo"
              width={220}
              height={60}
              className="h-16 w-auto"
              priority
            />
          </div>
          <h1 className="text-2xl gradient-text mb-2">Billing Admin</h1>
          <p className="text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
            MFA Protected • Super User Access
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">{showMFA ? 'Enter MFA Code' : 'Sign In'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!showMFA ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Input
                  label="Email"
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                />

                <Input
                  label="Password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  Sign In
                </Button>

                {/* Demo Credentials */}
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg mt-4">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    🎯 Demo Login Credentials:
                  </p>
                  <div className="space-y-1 text-sm text-blue-800 dark:text-blue-400 font-mono">
                    <p><strong>Email:</strong> demo@nexasync.com</p>
                    <p><strong>Password:</strong> demo123</p>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-500 mt-2">
                    MFA is disabled for demo account
                  </p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg mt-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <Shield className="w-4 h-4 inline mr-2" />
                    This system requires authorized access. Contact your administrator if you need access.
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMFAVerify} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      Multi-Factor Authentication Required
                    </p>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                </div>

                <Input
                  label="MFA Code"
                  type="text"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowMFA(false)
                      setMfaToken('')
                      setError('')
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" loading={loading}>
                    Verify
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Protected by Supabase Authentication & MFA
        </p>
      </div>
    </div>
  )
}
