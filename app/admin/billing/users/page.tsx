'use client'

import React, { useState, useEffect } from 'react'
import { UserPlus, Shield, Trash2, Edit, Key } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import type { BillingUser } from '@/lib/types/auth'

export default function UsersPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<BillingUser[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<BillingUser | null>(null)
  const [editingUser, setEditingUser] = useState<BillingUser | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'admin' as 'super_admin' | 'admin',
    mfa_enabled: false
  })

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('billing_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
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

    try {
      if (editingUser) {
        // Update existing user
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
        alert('User updated successfully')
      } else {
        // Create new user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name
            }
          }
        })

        if (authError) throw authError

        // Create billing user record
        if (authData.user) {
          const { data: userData } = await supabase.auth.getUser()

          const { error: userError } = await supabase
            .from('billing_users')
            .insert({
              auth_user_id: authData.user.id,
              email: formData.email,
              full_name: formData.full_name,
              role: formData.role,
              mfa_enabled: formData.mfa_enabled,
              is_active: true,
              created_by: userData.user?.id
            })

          if (userError) throw userError
          alert('User created successfully. They will receive an email to confirm their account.')
        }
      }

      closeModal()
      loadUsers()
    } catch (error) {
      console.error('Failed to save user:', error)
      alert('Failed to save user: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  async function handleDelete(user: BillingUser) {
    if (!confirm(`Are you sure you want to delete ${user.full_name}?`)) return

    try {
      // Deactivate user instead of deleting
      const { error } = await supabase
        .from('billing_users')
        .update({ is_active: false })
        .eq('id', user.id)

      if (error) throw error
      alert('User deactivated successfully')
      loadUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
      alert('Failed to delete user')
    }
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
    const action = user.mfa_enabled ? 'disable' : 'enable'
    if (!confirm(`Are you sure you want to ${action} MFA for ${user.full_name}?`)) return

    try {
      const { error } = await supabase
        .from('billing_users')
        .update({
          mfa_enabled: !user.mfa_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      alert(`MFA ${action}d successfully`)

      // Update selectedUser if detail modal is open
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...user, mfa_enabled: !user.mfa_enabled })
      }

      loadUsers()
    } catch (error) {
      console.error('Failed to toggle MFA:', error)
      alert(`Failed to ${action} MFA`)
    }
  }

  function openAddModal() {
    setEditingUser(null)
    setFormData({
      email: '',
      full_name: '',
      password: '',
      role: 'admin',
      mfa_enabled: false
    })
    setShowModal(true)
  }

  function openEditModal(user: BillingUser) {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
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

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black gradient-text">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage system users and permissions</p>
        </div>
        <Button onClick={openAddModal}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
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
                {users.map((user) => (
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

          {!editingUser && (
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              helperText="Minimum 8 characters"
              required
            />
          )}

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
    </div>
  )
}
