'use client'

import React, { useState, useEffect } from 'react'
import { UserPlus, Shield, Trash2, Edit, Key, Mail, Copy, QrCode, XCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { mfaService } from '@/lib/services/mfaService'
import type { BillingUser } from '@/lib/types/auth'
import { useNotification } from '@/components/ui/Notification'
import { updateUserPassword } from './actions'

export default function UsersPage() {
  const { showNotification, showConfirm } = useNotification()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<BillingUser[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending'>('all')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false)
  const [mfaSetupStep, setMfaSetupStep] = useState<'qrcode' | 'verify' | 'backup'>('qrcode')
  const [mfaSetupUser, setMfaSetupUser] = useState<BillingUser | null>(null)
  const [mfaData, setMfaData] = useState({ secret: '', qrCode: '', backupCodes: [] as string[] })
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [selectedUser, setSelectedUser] = useState<BillingUser | null>(null)
  const [editingUser, setEditingUser] = useState<BillingUser | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    confirmPassword: '',
    role: 'admin' as 'super_admin' | 'admin',
    mfa_enabled: false
  })
  const [passwordsMatch, setPasswordsMatch] = useState(true)
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'admin' as 'super_admin' | 'admin'
  })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordChangeUser, setPasswordChangeUser] = useState<BillingUser | null>(null)
  const [passwordChangeData, setPasswordChangeData] = useState({
    newPassword: '',
    confirmNewPassword: ''
  })

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('Not authenticated')
        setUsers([])
        return
      }

      const { data, error } = await supabase
        .from('billing_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }
      setUsers(data || [])
    } catch (error) {
      console.error('Failed to load users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate passwords match
    if (formData.password && formData.password !== formData.confirmPassword) {
      showNotification('Passwords do not match', 'error')
      return
    }

    // Validate password length if provided
    if (formData.password && formData.password.length < 8) {
      showNotification('Password must be at least 8 characters', 'error')
      return
    }

    try {
      if (editingUser) {
        // Update existing user in billing_users
        const { error } = await supabase
          .from('billing_users')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            mfa_enabled: formData.mfa_enabled,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id)

        if (error) throw error

        // Update password if provided
        if (formData.password) {
          if (!editingUser.auth_user_id) {
            throw new Error('User has no associated auth account')
          }
          const result = await updateUserPassword(editingUser.auth_user_id, formData.password)

          if (!result.success) {
            throw new Error(result.error || 'Failed to update password')
          }
          showNotification('User and password updated successfully', 'success')
        } else {
          showNotification('User updated successfully', 'success')
        }
      } else {
        // Create user directly with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name
            },
            emailRedirectTo: `${window.location.origin}/login`
          }
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Failed to create auth user')

        // Get current user for created_by field
        const { data: { user: currentUser } } = await supabase.auth.getUser()

        // Create billing user record
        const { data: newUser, error: userError } = await supabase
          .from('billing_users')
          .insert({
            auth_user_id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            is_active: true,
            mfa_enabled: formData.mfa_enabled,
            created_by: currentUser?.id || null
          })
          .select()
          .single()

        if (userError) throw userError

        // If MFA is enabled, show MFA setup modal
        if (formData.mfa_enabled && newUser) {
          closeModal()
          await setupMfaForUser(newUser)
          return
        }

        showNotification('User created successfully!', 'success')
      }

      closeModal()
      loadUsers()
    } catch (error) {
      console.error('Failed to save user:', error)
      showNotification('Failed to save user: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
    }
  }

  async function handleDelete(user: BillingUser) {
    showConfirm(`Are you sure you want to permanently delete ${user.full_name}? This action cannot be undone.`, async () => {
      try {
        // First, delete from Supabase Auth if auth_user_id exists
        if (user.auth_user_id) {
          try {
            // Try to delete from auth.users using the admin API
            // Note: This requires service role key, so we'll handle gracefully if it fails
            const { data: { user: authUser } } = await supabase.auth.getUser()

            // We can't delete auth users with anon key, so we'll just delete from billing_users
            console.log('Note: Auth user cannot be deleted with current permissions. Only removing from billing_users.')
          } catch (authError) {
            console.log('Auth deletion skipped:', authError)
          }
        }

        // Delete from billing_users table
        const { error } = await supabase
          .from('billing_users')
          .delete()
          .eq('id', user.id)

        if (error) throw error

        showNotification('User deleted successfully', 'success')
        loadUsers()
      } catch (error) {
        console.error('Failed to delete user:', error)
        showNotification('Failed to delete user: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
      }
    })
  }

  async function handleApproveUser(user: BillingUser) {
    showConfirm(`Approve ${user.full_name} and allow them to log in?`, async () => {
      try {
        const { error } = await supabase
          .from('billing_users')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', user.id)

        if (error) throw error
        showNotification(`${user.full_name} has been approved`, 'success')
        loadUsers()
      } catch (error) {
        console.error('Failed to approve user:', error)
        showNotification('Failed to approve user', 'error')
      }
    })
  }

  async function handleToggleActive(user: BillingUser) {
    try {
      const { error } = await supabase
        .from('billing_users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id)

      if (error) throw error
      loadUsers()
    } catch (error) {
      console.error('Failed to toggle user status:', error)
    }
  }

  async function handleToggleMFA(user: BillingUser) {
    if (user.mfa_enabled) {
      // Disabling MFA
      showConfirm(`Are you sure you want to disable MFA for ${user.full_name}?`, async () => {
        try {
          const { error } = await supabase
            .from('billing_users')
            .update({
              mfa_enabled: false,
              mfa_secret: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

          if (error) throw error
          showNotification('MFA disabled successfully', 'success')

          // Update selectedUser if detail modal is open
          if (selectedUser?.id === user.id) {
            setSelectedUser({ ...user, mfa_enabled: false })
          }

          loadUsers()
        } catch (error) {
          console.error('Failed to disable MFA:', error)
          showNotification('Failed to disable MFA', 'error')
        }
      })
    } else {
      // Enabling MFA - trigger setup flow
      setShowDetailModal(false) // Close detail modal first
      await setupMfaForUser(user)
    }
  }

  function openPasswordChangeModal(user: BillingUser) {
    setPasswordChangeUser(user)
    setPasswordChangeData({
      newPassword: '',
      confirmNewPassword: ''
    })
    setShowPasswordModal(true)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()

    if (!passwordChangeUser) return

    if (passwordChangeData.newPassword !== passwordChangeData.confirmNewPassword) {
      showNotification('Passwords do not match', 'error')
      return
    }

    if (passwordChangeData.newPassword.length < 8) {
      showNotification('Password must be at least 8 characters', 'error')
      return
    }

    try {
      // Use server action to update user password
      if (!passwordChangeUser.auth_user_id) {
        throw new Error('User has no associated auth account')
      }

      const result = await updateUserPassword(
        passwordChangeUser.auth_user_id,
        passwordChangeData.newPassword
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to update password')
      }

      showNotification(`Password updated successfully for ${passwordChangeUser.full_name}`, 'success')
      setShowPasswordModal(false)
      setPasswordChangeUser(null)
      setPasswordChangeData({ newPassword: '', confirmNewPassword: '' })
    } catch (error) {
      console.error('Failed to change password:', error)
      showNotification(error instanceof Error ? error.message : 'Failed to change password', 'error')
    }
  }

  function openAddModal() {
    setEditingUser(null)
    setFormData({
      email: '',
      full_name: '',
      password: '',
      confirmPassword: '',
      role: 'admin',
      mfa_enabled: false
    })
    setPasswordsMatch(true)
    setShowModal(true)
  }

  function openEditModal(user: BillingUser) {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
      confirmPassword: '',
      role: user.role,
      mfa_enabled: user.mfa_enabled
    })
    setShowModal(true)
  }

  function viewDetails(user: BillingUser) {
    setSelectedUser(user)
    setShowDetailModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUser(null)
  }

  function openInviteModal() {
    setInviteData({ email: '', role: 'admin' })
    setInviteUrl('')
    setShowInviteModal(true)
  }

  function closeInviteModal() {
    setShowInviteModal(false)
    setInviteData({ email: '', role: 'admin' })
    setInviteUrl('')
  }

  async function setupMfaForUser(user: BillingUser) {
    try {
      // Generate MFA secret and QR code
      const secret = mfaService.generateSecret()
      const qrCode = await mfaService.generateQRCode(user.email, secret)
      const backupCodes = mfaService.generateBackupCodes()

      setMfaData({ secret, qrCode, backupCodes })
      setMfaSetupUser(user)
      setShowMfaSetupModal(true)
    } catch (error) {
      console.error('Failed to generate MFA setup:', error)
      showNotification('Failed to generate MFA setup', 'error')
    }
  }

  async function saveMfaSetup() {
    if (!mfaSetupUser) return

    try {
      // Encrypt and save the secret
      const encryptedSecret = mfaService.encryptSecret(mfaData.secret)

      const { error } = await supabase
        .from('billing_users')
        .update({
          mfa_enabled: true,
          mfa_secret: encryptedSecret,
          updated_at: new Date().toISOString()
        })
        .eq('id', mfaSetupUser.id)

      if (error) throw error

      showNotification('MFA setup completed successfully! User can now use their authenticator app to log in.', 'success')
      setShowMfaSetupModal(false)
      setMfaSetupUser(null)
      loadUsers()
    } catch (error) {
      console.error('Failed to save MFA setup:', error)
      showNotification('Failed to save MFA setup', 'error')
    }
  }

  function closeMfaSetupModal() {
    setShowMfaSetupModal(false)
    setMfaSetupStep('qrcode')
    setMfaSetupUser(null)
    setMfaData({ secret: '', qrCode: '', backupCodes: [] })
    setVerificationCode('')
    setVerificationError('')
  }

  function handleVerifyCode() {
    setVerificationError('')

    if (verificationCode.length !== 6) {
      setVerificationError('Please enter a 6-digit code')
      return
    }

    // Verify the token using mfaService
    const isValid = mfaService.verifyToken(verificationCode, mfaData.secret)

    if (!isValid) {
      setVerificationError('Invalid verification code. Please try again.')
      return
    }

    // Code is valid, proceed to backup codes
    setVerificationCode('')
    setMfaSetupStep('backup')
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      showNotification('Copied to clipboard!', 'success')
    } catch (error) {
      showNotification('Failed to copy', 'error')
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      // Generate invite token
      const inviteToken = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

      // Create invite record
      const { error: inviteError } = await supabase
        .from('user_invites')
        .insert({
          email: inviteData.email,
          role: inviteData.role,
          invited_by: userData.user.id,
          invite_token: inviteToken,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })

      if (inviteError) throw inviteError

      // Generate invite URL
      const inviteUrl = `${window.location.origin}/signup?token=${inviteToken}`
      setInviteUrl(inviteUrl)
      showNotification('Invite created successfully! Share the link below.', 'success')
    } catch (error) {
      console.error('Failed to send invite:', error)
      showNotification('Failed to send invite: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
    }
  }

  async function copyInviteUrl() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      showNotification('Invite link copied to clipboard!', 'success')
    } catch (error) {
      showNotification('Failed to copy link', 'error')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  // Filter users based on status
  const filteredUsers = users.filter(user => {
    if (filterStatus === 'active') return user.is_active
    if (filterStatus === 'pending') return !user.is_active
    return true // 'all'
  })

  const pendingCount = users.filter(u => !u.is_active).length

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black gradient-text">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage system users and permissions</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={openInviteModal} variant="secondary">
            <Mail className="w-4 h-4 mr-2" />
            Invite User
          </Button>
          <Button onClick={openAddModal}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'primary' : 'secondary'}
                onClick={() => setFilterStatus('all')}
                size="sm"
              >
                All ({users.length})
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'primary' : 'secondary'}
                onClick={() => setFilterStatus('active')}
                size="sm"
              >
                Active ({users.filter(u => u.is_active).length})
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'primary' : 'secondary'}
                onClick={() => setFilterStatus('pending')}
                size="sm"
              >
                Pending ({pendingCount})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">MFA</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Last Login</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => viewDetails(user)}
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{user.full_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td className="py-3 px-4">
                      {user.role === 'super_admin' ? (
                        <Badge color="blue">
                          <Shield className="w-3 h-3 mr-1" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge color="gray">Admin</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.mfa_enabled ? (
                        <Badge color="green">
                          <Key className="w-3 h-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge color="yellow">Disabled</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.is_active ? (
                        <Badge color="green">Active</Badge>
                      ) : (
                        <Badge color="red">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {!user.is_active && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApproveUser(user)
                            }}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            title="Approve user"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(user)
                          }}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleActive(user)
                          }}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(user)
                          }}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {selectedUser && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title="User Details"
          size="lg"
        >
          <div className="space-y-6">
            {/* User Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">User Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Full Name</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedUser.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Role</p>
                  <div className="mt-1">
                    {selectedUser.role === 'super_admin' ? (
                      <Badge color="blue">
                        <Shield className="w-3 h-3 mr-1" />
                        Super Admin
                      </Badge>
                    ) : (
                      <Badge color="gray">Admin</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <div className="mt-1">
                    {selectedUser.is_active ? (
                      <Badge color="green">Active</Badge>
                    ) : (
                      <Badge color="red">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Multi-Factor Authentication</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedUser.mfa_enabled
                        ? 'MFA is currently enabled for this user'
                        : 'MFA is currently disabled for this user'}
                    </p>
                  </div>
                  <Button
                    variant={selectedUser.mfa_enabled ? 'secondary' : 'primary'}
                    onClick={() => handleToggleMFA(selectedUser)}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    {selectedUser.mfa_enabled ? 'Disable MFA' : 'Enable MFA'}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Password</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Change the user's password
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => openPasswordChangeModal(selectedUser)}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">MFA Status</p>
                    <div className="mt-1">
                      {selectedUser.mfa_enabled ? (
                        <Badge color="green">
                          <Key className="w-3 h-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge color="yellow">Disabled</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Last Login</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Account Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(selectedUser.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">User ID</p>
                  <p className="font-mono text-xs text-gray-900 dark:text-gray-100">{selectedUser.id}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowDetailModal(false)
                  openEditModal(selectedUser)
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit User
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={!!editingUser}
            required
          />

          {editingUser && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-3 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Change Password:</strong> Leave password fields blank to keep the current password. Enter a new password to update it.
              </p>
            </div>
          )}

          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => {
              const newPassword = e.target.value
              setFormData({ ...formData, password: newPassword })
              // Check if passwords match in real-time
              setPasswordsMatch(newPassword === formData.confirmPassword || formData.confirmPassword === '')
            }}
            helpText={editingUser ? "Leave blank to keep current password (minimum 8 characters if changing)" : "Minimum 8 characters"}
            required={!editingUser}
          />

          <div className="relative">
            <Input
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => {
                const newConfirm = e.target.value
                setFormData({ ...formData, confirmPassword: newConfirm })
                // Check if passwords match in real-time
                setPasswordsMatch(formData.password === newConfirm || newConfirm === '')
              }}
              required={!editingUser}
            />
            {formData.confirmPassword && (
              <div className="absolute right-3 top-9 pointer-events-none">
                {passwordsMatch ? (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Match</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
                    <XCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">Don't match</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Role</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.role === 'admin'}
                  onChange={() => setFormData({ ...formData, role: 'admin' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Admin (Can manage billing data)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.role === 'super_admin'}
                  onChange={() => setFormData({ ...formData, role: 'super_admin' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Super Admin (Full access + user management)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.mfa_enabled}
                onChange={(e) => setFormData({ ...formData, mfa_enabled: e.target.checked })}
                className="mr-2 rounded"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Require MFA for this user</span>
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={closeInviteModal}
        title="Invite User"
      >
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Generate an invitation link that can be shared with the new user to sign up.
            </p>
          </div>

          <Input
            label="Email"
            type="email"
            value={inviteData.email}
            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Role</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={inviteData.role === 'admin'}
                  onChange={() => setInviteData({ ...inviteData, role: 'admin' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Admin (Can manage billing data)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={inviteData.role === 'super_admin'}
                  onChange={() => setInviteData({ ...inviteData, role: 'super_admin' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Super Admin (Full access + user management)</span>
              </label>
            </div>
          </div>

          {inviteUrl && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Invitation Link Generated!</p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 rounded text-sm"
                />
                <Button type="button" variant="secondary" onClick={copyInviteUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                Share this link with the user. It expires in 7 days.
              </p>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={closeInviteModal}>
              {inviteUrl ? 'Close' : 'Cancel'}
            </Button>
            {!inviteUrl && (
              <Button type="submit">
                <Mail className="w-4 h-4 mr-2" />
                Generate Invite Link
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* MFA Setup Modal */}
      <Modal
        isOpen={showMfaSetupModal}
        onClose={closeMfaSetupModal}
        title={`Set Up MFA for ${mfaSetupUser?.full_name}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Page 1: QR Code and Manual Key */}
          {mfaSetupStep === 'qrcode' && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Step 1 of 3:</strong> Show this QR code to the user so they can scan it with their authenticator app (Google Authenticator, Authy, etc.).
                </p>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Scan QR Code
                </h3>
                {mfaData.qrCode ? (
                  <div className="flex justify-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <img src={mfaData.qrCode} alt="MFA QR Code" className="w-64 h-64" />
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      QR code is generating...
                    </p>
                  </div>
                )}
              </div>

              {/* Manual Entry Key */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Manual Setup Key</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  If the user can't scan the QR code, they can enter this key manually:
                </p>
                <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <code className="flex-1 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {mfaService.formatSecretForDisplay(mfaData.secret)}
                  </code>
                  <button
                    onClick={() => copyToClipboard(mfaData.secret)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="secondary" onClick={closeMfaSetupModal}>
                  Cancel
                </Button>
                <Button onClick={() => setMfaSetupStep('verify')}>
                  Next: Verify Setup
                </Button>
              </div>
            </>
          )}

          {/* Page 2: Verify Code */}
          {mfaSetupStep === 'verify' && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Step 2 of 3:</strong> Enter the 6-digit code from your authenticator app to verify the setup.
                </p>
              </div>

              <div className="text-center space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Verify Authenticator Code
                </h3>

                {verificationError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {verificationError}
                  </div>
                )}

                <div className="max-w-xs mx-auto">
                  <Input
                    label="6-Digit Code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Open your authenticator app and enter the 6-digit code shown for this account.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="secondary" onClick={() => setMfaSetupStep('qrcode')}>
                  Back
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={verificationCode.length !== 6}
                >
                  Verify and Continue
                </Button>
              </div>
            </>
          )}

          {/* Page 3: Backup Codes */}
          {mfaSetupStep === 'backup' && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Step 3 of 3:</strong> Save these backup codes in a secure location. The user will need them if they lose access to their authenticator app.
                </p>
              </div>

              {/* Backup Codes */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Backup Recovery Codes</h4>
                  <button
                    onClick={() => copyToClipboard(mfaData.backupCodes.join('\n'))}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Copy className="w-4 h-4" />
                    Copy All
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Each code can only be used once. Store them in a password manager or safe location.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {mfaData.backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-center text-gray-900 dark:text-gray-100"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Important:</strong> Make sure the user has successfully added the authenticator and saved these backup codes before completing setup.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="secondary" onClick={() => setMfaSetupStep('verify')}>
                  Back
                </Button>
                <Button onClick={saveMfaSetup}>
                  <Shield className="w-4 h-4 mr-2" />
                  Complete MFA Setup
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          setPasswordChangeUser(null)
          setPasswordChangeData({ newPassword: '', confirmNewPassword: '' })
        }}
        title={`Change Password for ${passwordChangeUser?.full_name}`}
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Enter a new password for this user. The password must be at least 8 characters long.
            </p>
          </div>

          <Input
            label="New Password"
            type="password"
            value={passwordChangeData.newPassword}
            onChange={(e) => setPasswordChangeData({ ...passwordChangeData, newPassword: e.target.value })}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            helpText="Minimum 8 characters"
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={passwordChangeData.confirmNewPassword}
            onChange={(e) => setPasswordChangeData({ ...passwordChangeData, confirmNewPassword: e.target.value })}
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowPasswordModal(false)
                setPasswordChangeUser(null)
                setPasswordChangeData({ newPassword: '', confirmNewPassword: '' })
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Update Password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
