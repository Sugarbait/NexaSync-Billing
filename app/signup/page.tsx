'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import Image from 'next/image'

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [inviteValid, setInviteValid] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    password: '',
    confirmPassword: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) {
      validateInvite()
    } else {
      setLoading(false)
      setError('No invite token provided')
    }
  }, [token])

  async function validateInvite() {
    try {
      const { data: invite, error } = await supabase
        .from('user_invites')
        .select('*')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .single()

      if (error || !invite) {
        setError('Invalid or expired invitation')
        setInviteValid(false)
        return
      }

      // Check if expired
      const now = new Date()
      const expiresAt = new Date(invite.expires_at)
      if (now > expiresAt) {
        setError('This invitation has expired')
        setInviteValid(false)
        return
      }

      setInviteData(invite)
      setInviteValid(true)
    } catch (error) {
      console.error('Failed to validate invite:', error)
      setError('Failed to validate invitation')
      setInviteValid(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Create billing user record
        const { error: userError } = await supabase
          .from('billing_users')
          .insert({
            auth_user_id: authData.user.id,
            email: inviteData.email,
            full_name: formData.full_name,
            role: inviteData.role,
            is_active: true,
            created_by: inviteData.invited_by
          })

        if (userError) throw userError

        // Mark invite as accepted
        await supabase
          .from('user_invites')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', inviteData.id)

        // Redirect to login
        router.push('/login?message=Account created successfully. Please log in.')
      }
    } catch (error) {
      console.error('Signup error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Image
            src="https://nexasync.ca/images/NexaSync-White.png"
            alt="NexaSync Logo"
            width={220}
            height={60}
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-3xl font-black gradient-text mb-2">Create Your Account</h1>
          <p className="text-gray-400">NexaSync Billing Platform</p>
        </div>

        {!inviteValid ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="text-lg font-semibold text-red-400">Invalid Invitation</h3>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                You've been invited as <strong>{inviteData.role === 'super_admin' ? 'Super Admin' : 'Admin'}</strong> to {inviteData.email}
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />

              <Input
                label="Email"
                type="email"
                value={inviteData.email}
                disabled
              />

              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                helperText="Minimum 8 characters"
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />

              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                loading={submitting}
              >
                Create Account
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
