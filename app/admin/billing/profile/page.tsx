'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, Key, Save, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import type { BillingUser, LoginHistory } from '@/lib/types/auth'
import { useNotification } from '@/components/ui/Notification'

export default function ProfilePage() {
  const { showNotification } = useNotification()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<BillingUser | null>(null)
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([])
  const [formData, setFormData] = useState({
    full_name: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: billingUser } = await supabase
        .from('billing_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (billingUser) {
        setCurrentUser(billingUser)
        setFormData({
          ...formData,
          full_name: billingUser.full_name
        })
      }

      // Load login history
      const { data: history } = await supabase
        .from('login_history')
        .select('*')
        .eq('billing_user_id', billingUser?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (history) {
        setLoginHistory(history)
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      if (!currentUser) throw new Error('No user loaded')

      // Update name
      const { error } = await supabase
        .from('billing_users')
        .update({
          full_name: formData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)

      if (error) throw error

      showNotification('Profile updated successfully', 'success')
      loadProfile()
    } catch (error) {
      console.error('Failed to update profile:', error)
      showNotification('Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      if (formData.new_password !== formData.confirm_password) {
        throw new Error('Passwords do not match')
      }

      if (formData.new_password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      const { error } = await supabase.auth.updateUser({
        password: formData.new_password
      })

      if (error) throw error

      showNotification('Password changed successfully', 'success')
      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error) {
      console.error('Failed to change password:', error)
      showNotification('Failed to change password: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text">My Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your account settings and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input
                  label="Full Name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />

                <Input
                  label="Email"
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  helperText="Email cannot be changed"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Role
                  </label>
                  <Badge color={currentUser?.role === 'super_admin' ? 'blue' : 'gray'}>
                    {currentUser?.role === 'super_admin' ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Super Admin
                      </>
                    ) : (
                      'Admin'
                    )}
                  </Badge>
                </div>

                <Button type="submit" loading={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input
                  label="New Password"
                  type="password"
                  value={formData.new_password}
                  onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                  helperText="Minimum 8 characters"
                  required
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  required
                />

                <Button type="submit" loading={saving}>
                  <Key className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Security Status */}
          <Card>
            <CardHeader>
              <CardTitle>Security Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Multi-Factor Authentication</p>
                {currentUser?.mfa_enabled ? (
                  <Badge color="green">
                    <Shield className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge color="yellow">Disabled</Badge>
                )}
                <Link href="/admin/billing/profile/mfa-setup">
                  <Button variant="secondary" size="sm" className="mt-2 w-full">
                    <Key className="w-3 h-3 mr-1" />
                    {currentUser?.mfa_enabled ? 'Manage MFA' : 'Enable MFA'}
                  </Button>
                </Link>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Account Status</p>
                <Badge color={currentUser?.is_active ? 'green' : 'red'}>
                  {currentUser?.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Last Login</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {currentUser?.last_login_at
                    ? new Date(currentUser.last_login_at).toLocaleString()
                    : 'Never'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Member Since</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {currentUser?.created_at
                    ? new Date(currentUser.created_at).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Login History */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Clock className="w-4 h-4 inline mr-2" />
                Recent Login Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loginHistory.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No login history available</p>
                ) : (
                  loginHistory.map((login) => (
                    <div key={login.id} className="flex items-start gap-2 pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {login.login_successful ? (
                            <Badge color="green">Success</Badge>
                          ) : (
                            <Badge color="red">Failed</Badge>
                          )}
                          {login.mfa_verified && (
                            <Badge color="blue">
                              <Shield className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {new Date(login.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
