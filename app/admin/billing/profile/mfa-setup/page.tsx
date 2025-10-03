'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Key, Copy, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { mfaService } from '@/lib/services/mfaService'
import type { BillingUser } from '@/lib/types/auth'

export default function MFASetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'generate' | 'verify' | 'complete'>('generate')
  const [currentUser, setCurrentUser] = useState<BillingUser | null>(null)
  const [mfaData, setMfaData] = useState({
    secret: '',
    qrCode: '',
    backupCodes: [] as string[]
  })
  const [verificationToken, setVerificationToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: billingUser } = await supabase
        .from('billing_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (billingUser) {
        setCurrentUser(billingUser)

        // If MFA already enabled, skip to complete
        if (billingUser.mfa_enabled && billingUser.mfa_secret) {
          setStep('complete')
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateSecret() {
    try {
      if (!currentUser) throw new Error('No user loaded')

      setLoading(true)
      setError('')

      // Generate new secret
      const secret = mfaService.generateSecret()

      // Generate QR code
      const qrCode = await mfaService.generateQRCode(currentUser.email, secret)

      // Generate backup codes
      const backupCodes = mfaService.generateBackupCodes()

      setMfaData({
        secret,
        qrCode,
        backupCodes
      })

      setStep('verify')
    } catch (error) {
      console.error('Failed to generate MFA secret:', error)
      setError('Failed to generate MFA secret')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyAndEnable() {
    try {
      if (!currentUser) throw new Error('No user loaded')

      setLoading(true)
      setError('')

      // Verify the token
      const isValid = mfaService.verifyToken(verificationToken, mfaData.secret)

      if (!isValid) {
        throw new Error('Invalid verification code. Please try again.')
      }

      // Encrypt and save the secret
      const encryptedSecret = mfaService.encryptSecret(mfaData.secret)

      const { error: updateError } = await supabase
        .from('billing_users')
        .update({
          mfa_enabled: true,
          mfa_secret: encryptedSecret,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)

      if (updateError) throw updateError

      setStep('complete')
    } catch (error) {
      console.error('Failed to enable MFA:', error)
      setError(error instanceof Error ? error.message : 'Failed to enable MFA')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableMFA() {
    if (!confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
      return
    }

    try {
      if (!currentUser) throw new Error('No user loaded')

      setLoading(true)

      const { error } = await supabase
        .from('billing_users')
        .update({
          mfa_enabled: false,
          mfa_secret: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)

      if (error) throw error

      router.push('/admin/billing/profile')
    } catch (error) {
      console.error('Failed to disable MFA:', error)
      alert('Failed to disable MFA')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  if (loading && step === 'generate') {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Link href="/admin/billing/profile">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Profile
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text">Multi-Factor Authentication</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Secure your account with time-based one-time passwords (TOTP)
        </p>
      </div>

      <div className="max-w-2xl">
        {step === 'generate' && (
          <Card>
            <CardHeader>
              <CardTitle>Enable MFA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                      Why enable MFA?
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                      Multi-Factor Authentication adds an extra layer of security to your account. Even if someone
                      knows your password, they won't be able to access your account without your authenticator app.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  <strong>What you'll need:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>A TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
                  <li>Your smartphone or device with the authenticator app</li>
                </ul>
              </div>

              <Button onClick={handleGenerateSecret} loading={loading} className="w-full">
                <Key className="w-4 h-4 mr-2" />
                Generate MFA Secret
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Scan this QR code with your authenticator app:
                </p>

                {mfaData.qrCode && (
                  <div className="flex justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <img src={mfaData.qrCode} alt="MFA QR Code" className="w-64 h-64" />
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Or enter this code manually:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <code className="flex-1 text-sm font-mono">
                      {mfaService.formatSecretForDisplay(mfaData.secret)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(mfaData.secret)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 2: Verify Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter the 6-digit code from your authenticator app to verify the setup:
                </p>

                <Input
                  label="Verification Code"
                  type="text"
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                />

                <Button
                  onClick={handleVerifyAndEnable}
                  loading={loading}
                  disabled={verificationToken.length !== 6}
                  className="w-full"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Verify and Enable MFA
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup Codes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Save these backup codes in a secure location. You can use them to access your account
                    if you lose access to your authenticator app.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {mfaData.backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-center font-mono text-sm"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(mfaData.backupCodes.join('\n'))}
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Backup Codes
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'complete' && (
          <Card>
            <CardHeader>
              <CardTitle>
                <CheckCircle className="w-5 h-5 inline text-green-600 dark:text-green-400 mr-2" />
                MFA is Enabled
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">
                  Your account is now protected with Multi-Factor Authentication. You'll need to enter
                  a code from your authenticator app every time you sign in.
                </p>
              </div>

              <Badge color="green" className="text-base px-4 py-2">
                <Shield className="w-4 h-4 mr-2" />
                MFA Active
              </Badge>

              <div className="pt-4 space-y-3">
                <Link href="/admin/billing/profile">
                  <Button variant="primary" className="w-full">
                    Return to Profile
                  </Button>
                </Link>

                <Button
                  variant="secondary"
                  onClick={handleDisableMFA}
                  loading={loading}
                  className="w-full text-red-600 dark:text-red-400"
                >
                  Disable MFA
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
