/**
 * ⚠️ SECURITY CRITICAL FILE - DO NOT MODIFY WITHOUT AUTHORIZATION ⚠️
 *
 * This file contains authentication and MFA login logic.
 * Any unauthorized changes could compromise system security.
 *
 * Protected Features:
 * - MFA enforcement (lines 74-79, 132-141)
 * - Session verification (lines 98-99, 160-161)
 * - Bypass prevention (lines 288-294)
 *
 * Contact: elitesquadp@protonmail.com for authorization
 */

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
  const [showRegister, setShowRegister] = useState(false)
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  })
  const [mfaToken, setMfaToken] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
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
        throw new Error('Your account is pending approval from an administrator. Please wait for activation.')
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

      // Store session flag (no MFA required for this user)
      sessionStorage.setItem('mfa_verified', 'true')
      sessionStorage.setItem('mfa_verified_at', new Date().toISOString())

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

      // Store MFA verification flag in session
      sessionStorage.setItem('mfa_verified', 'true')
      sessionStorage.setItem('mfa_verified_at', new Date().toISOString())

      // Redirect to dashboard
      router.push('/admin/billing')
    } catch (error) {
      console.error('MFA verification error:', error)
      setError(error instanceof Error ? error.message : 'MFA verification failed')
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      // Validation
      if (registerData.password !== registerData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (registerData.password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      if (!registerData.fullName.trim()) {
        throw new Error('Full name is required')
      }

      // Create user via server-side API
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          full_name: registerData.fullName,
          role: 'admin',
          mfa_enabled: false,
          is_active: false // Requires admin approval
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      // Show success message and redirect to login
      setError('')
      setShowRegister(false)
      setRegisterData({ email: '', password: '', confirmPassword: '', fullName: '' })

      // Show a success message that account needs approval
      setSuccessMessage('Registration successful! Your account is pending approval from an administrator. You will be able to log in once your account is activated.')

      // No auto-login - user must wait for approval
    } catch (error) {
      console.error('Registration error:', error)
      setError(error instanceof Error ? error.message : 'Registration failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex items-start justify-center p-4 pt-8 md:pt-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex justify-center mb-3 md:mb-4">
            <Image
              src="https://nexasync.ca/images/NexaSync-White.png"
              alt="NexaSync Logo"
              width={220}
              height={60}
              className="h-12 md:h-16 w-auto"
              priority
            />
          </div>
          <h1 className="text-xl md:text-2xl gradient-text mb-2">Billing Admin</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="hidden sm:inline">MFA Protected • Super User Access</span>
            <span className="sm:hidden">MFA Protected</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {showMFA ? 'Enter MFA Code' : showRegister ? 'Create New Account' : 'Sign In'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showMFA ? (
              <form onSubmit={handleMFAVerify} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
                  <div className="flex flex-col items-center gap-3 mb-2">
                    <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm md:text-base font-semibold text-blue-900 dark:text-blue-300 text-center">
                      Multi-Factor Authentication Required
                    </p>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-400 text-center">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                </div>

                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1 text-center">
                    MFA Code
                  </label>
                  <input
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="\d{6}"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 text-center text-2xl tracking-widest font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      // Sign out user to prevent MFA bypass
                      await supabase.auth.signOut()
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
            ) : showRegister ? (
              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
                    {successMessage}
                  </div>
                )}

                <Input
                  label="Full Name"
                  type="text"
                  value={registerData.fullName}
                  onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                />

                <Input
                  label="Email"
                  type="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                />

                <Input
                  label="Password"
                  type="password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  helpText="Minimum 8 characters"
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />

                <Button type="submit" className="w-full" loading={loading}>
                  Create Account
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(false)
                      setError('')
                      setSuccessMessage('')
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
                    {successMessage}
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

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(true)
                      setError('')
                      setSuccessMessage('')
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Don't have an account? Create one
                  </button>
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
