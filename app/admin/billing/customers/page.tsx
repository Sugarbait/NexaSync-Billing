'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import type { BillingCustomer } from '@/lib/types/billing'
import { formatDate } from '@/lib/utils/format'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<BillingCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<BillingCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<BillingCustomer | null>(null)
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    retell_agent_ids: [] as string[],
    billing_contact_name: '',
    phone_number: '',
    billing_address: '',
    tax_id: '',
    markup_percentage: 0,
    auto_invoice_enabled: false,
    notes: ''
  })
  const [agentIdInput, setAgentIdInput] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  const filterCustomers = useCallback(() => {
    if (!searchQuery) {
      setFilteredCustomers(customers)
      return
    }

    const query = searchQuery.toLowerCase()
    setFilteredCustomers(
      customers.filter(c =>
        c.customer_name.toLowerCase().includes(query) ||
        c.customer_email.toLowerCase().includes(query)
      )
    )
  }, [searchQuery, customers])

  useEffect(() => {
    filterCustomers()
  }, [filterCustomers])

  async function loadCustomers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('billing_customers')
        .select('*')
        .order('customer_name', { ascending: true })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Failed to load customers:', error)
      alert('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setEditingCustomer(null)
    setFormData({
      customer_name: '',
      customer_email: '',
      retell_agent_ids: [],
      billing_contact_name: '',
      phone_number: '',
      billing_address: '',
      tax_id: '',
      markup_percentage: 0,
      auto_invoice_enabled: false,
      notes: ''
    })
    setAgentIdInput('')
    setShowModal(true)
  }

  function openEditModal(customer: BillingCustomer) {
    setEditingCustomer(customer)
    setFormData({
      customer_name: customer.customer_name,
      customer_email: customer.customer_email,
      retell_agent_ids: customer.retell_agent_ids || [],
      billing_contact_name: customer.billing_contact_name || '',
      phone_number: customer.phone_number || '',
      billing_address: customer.billing_address || '',
      tax_id: customer.tax_id || '',
      markup_percentage: customer.markup_percentage,
      auto_invoice_enabled: customer.auto_invoice_enabled,
      notes: customer.notes || ''
    })
    setAgentIdInput('')
    setShowModal(true)
  }

  function addAgentId() {
    if (!agentIdInput.trim()) return

    if (!formData.retell_agent_ids.includes(agentIdInput.trim())) {
      setFormData({
        ...formData,
        retell_agent_ids: [...formData.retell_agent_ids, agentIdInput.trim()]
      })
    }
    setAgentIdInput('')
  }

  function removeAgentId(agentId: string) {
    setFormData({
      ...formData,
      retell_agent_ids: formData.retell_agent_ids.filter(id => id !== agentId)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('billing_customers')
          .update(formData)
          .eq('id', editingCustomer.id)

        if (error) throw error
        alert('Customer updated successfully')
      } else {
        // Create new customer
        const { error } = await supabase
          .from('billing_customers')
          .insert([formData])

        if (error) throw error
        alert('Customer created successfully')
      }

      setShowModal(false)
      loadCustomers()
    } catch (error) {
      console.error('Failed to save customer:', error)
      alert('Failed to save customer')
    }
  }

  async function handleDelete(customer: BillingCustomer) {
    if (!confirm(`Are you sure you want to delete ${customer.customer_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('billing_customers')
        .delete()
        .eq('id', customer.id)

      if (error) throw error
      alert('Customer deleted successfully')
      loadCustomers()
    } catch (error) {
      console.error('Failed to delete customer:', error)
      alert('Failed to delete customer. They may have associated invoices.')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black gradient-text">Customer Management</h1>
          <p className="text-gray-600 mt-2">Manage billing customers and their settings</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customers ({filteredCustomers.length})</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Stripe Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Markup</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Invoice</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Created</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No customers found matching your search' : 'No customers yet. Add your first customer to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">{customer.customer_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{customer.customer_email}</td>
                      <td className="py-3 px-4 text-sm">
                        {customer.stripe_customer_id ? (
                          <Badge color="green">Connected</Badge>
                        ) : (
                          <Badge color="gray">Not Connected</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{customer.markup_percentage || 0}%</td>
                      <td className="py-3 px-4 text-sm">
                        {customer.auto_invoice_enabled ? (
                          <Badge color="blue">Enabled</Badge>
                        ) : (
                          <Badge color="gray">Disabled</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{formatDate(customer.created_at)}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Customer Name*"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
            />
            <Input
              label="Email*"
              type="email"
              value={formData.customer_email}
              onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              required
            />
          </div>

          {/* Retell Agent IDs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retell Agent IDs*
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Retell Agent ID (e.g., agent_abc123)"
                  value={agentIdInput}
                  onChange={(e) => setAgentIdInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addAgentId()
                    }
                  }}
                />
                <Button type="button" onClick={addAgentId}>Add</Button>
              </div>
              {formData.retell_agent_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  {formData.retell_agent_ids.map((agentId) => (
                    <div
                      key={agentId}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      <span>{agentId}</span>
                      <button
                        type="button"
                        onClick={() => removeAgentId(agentId)}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-500">
                Add one or more Retell Agent IDs. These will be used to filter chats/calls for billing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Name"
              value={formData.billing_contact_name}
              onChange={(e) => setFormData({ ...formData, billing_contact_name: e.target.value })}
            />
            <Input
              label="Phone"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            />
          </div>

          <Input
            label="Billing Address"
            value={formData.billing_address}
            onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tax ID"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            />
            <Input
              label="Markup Percentage"
              type="number"
              min="0"
              max="10000"
              step="0.1"
              value={formData.markup_percentage}
              onChange={(e) => setFormData({ ...formData, markup_percentage: parseFloat(e.target.value) })}
              helperText="e.g., 20 for 20% markup"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="auto_invoice"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={formData.auto_invoice_enabled}
              onChange={(e) => setFormData({ ...formData, auto_invoice_enabled: e.target.checked })}
            />
            <label htmlFor="auto_invoice" className="ml-2 text-sm text-gray-700">
              Enable automatic invoice generation
            </label>
          </div>

          <Input
            label="Notes"
            value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            helperText="Internal notes about this customer"
          />

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingCustomer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
