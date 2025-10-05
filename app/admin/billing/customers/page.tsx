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
import { useNotification } from '@/components/ui/Notification'

export default function CustomersPage() {
  const { showNotification, showConfirm } = useNotification()
  const [customers, setCustomers] = useState<BillingCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<BillingCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<BillingCustomer | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<BillingCustomer | null>(null)
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    retell_agent_ids: [] as string[],
    voice_agent_id: '',
    sms_agent_id: '',
    retell_api_key: '',
    twilio_phone_numbers: [] as string[],
    vonage_phone_numbers: [] as string[],
    billing_contact_name: '',
    phone_number: '',
    billing_address: '',
    tax_id: '',
    markup_percentage: 0,
    auto_invoice_enabled: false,
    notes: ''
  })
  const [phoneNumberInput, setPhoneNumberInput] = useState('')
  const [vonagePhoneNumberInput, setVonagePhoneNumberInput] = useState('')

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
      setCustomers([])
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
      voice_agent_id: '',
      sms_agent_id: '',
      retell_api_key: '',
      twilio_phone_numbers: [],
      vonage_phone_numbers: [],
      billing_contact_name: '',
      phone_number: '',
      billing_address: '',
      tax_id: '',
      markup_percentage: 0,
      auto_invoice_enabled: false,
      notes: ''
    })
    setPhoneNumberInput('')
    setVonagePhoneNumberInput('')
    setShowModal(true)
  }

  function viewDetails(customer: BillingCustomer) {
    setSelectedCustomer(customer)
    setShowDetailModal(true)
  }

  function openEditModal(customer: BillingCustomer) {
    setEditingCustomer(customer)
    setFormData({
      customer_name: customer.customer_name,
      customer_email: customer.customer_email,
      retell_agent_ids: customer.retell_agent_ids || [],
      voice_agent_id: customer.voice_agent_id || '',
      sms_agent_id: customer.sms_agent_id || '',
      retell_api_key: '', // Never pre-fill API key for security
      twilio_phone_numbers: customer.twilio_phone_numbers || [],
      vonage_phone_numbers: customer.vonage_phone_numbers || [],
      billing_contact_name: customer.billing_contact_name || '',
      phone_number: customer.phone_number || '',
      billing_address: customer.billing_address || '',
      tax_id: customer.tax_id || '',
      markup_percentage: customer.markup_percentage,
      auto_invoice_enabled: customer.auto_invoice_enabled,
      notes: customer.notes || ''
    })
    setPhoneNumberInput('')
    setVonagePhoneNumberInput('')
    setShowModal(true)
  }

  function addPhoneNumber() {
    if (!phoneNumberInput.trim()) return

    if (!formData.twilio_phone_numbers.includes(phoneNumberInput.trim())) {
      setFormData({
        ...formData,
        twilio_phone_numbers: [...formData.twilio_phone_numbers, phoneNumberInput.trim()]
      })
    }
    setPhoneNumberInput('')
  }

  function removePhoneNumber(phoneNumber: string) {
    setFormData({
      ...formData,
      twilio_phone_numbers: formData.twilio_phone_numbers.filter(num => num !== phoneNumber)
    })
  }

  function addVonagePhoneNumber() {
    if (!vonagePhoneNumberInput.trim()) return

    if (!formData.vonage_phone_numbers.includes(vonagePhoneNumberInput.trim())) {
      setFormData({
        ...formData,
        vonage_phone_numbers: [...formData.vonage_phone_numbers, vonagePhoneNumberInput.trim()]
      })
    }
    setVonagePhoneNumberInput('')
  }

  function removeVonagePhoneNumber(phoneNumber: string) {
    setFormData({
      ...formData,
      vonage_phone_numbers: formData.vonage_phone_numbers.filter(num => num !== phoneNumber)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      // Prepare data for save
      const saveData: any = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        retell_agent_ids: formData.retell_agent_ids,
        voice_agent_id: formData.voice_agent_id,
        sms_agent_id: formData.sms_agent_id,
        twilio_phone_numbers: formData.twilio_phone_numbers,
        vonage_phone_numbers: formData.vonage_phone_numbers,
        billing_contact_name: formData.billing_contact_name,
        phone_number: formData.phone_number,
        billing_address: formData.billing_address,
        tax_id: formData.tax_id,
        markup_percentage: formData.markup_percentage,
        auto_invoice_enabled: formData.auto_invoice_enabled,
        notes: formData.notes
      }

      // Only include API key if it was entered (not empty)
      if (formData.retell_api_key.trim()) {
        // TODO: Encrypt the API key before saving
        // For now, we'll save it directly (implement encryption in production)
        saveData.retell_api_key_encrypted = formData.retell_api_key
      }

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('billing_customers')
          .update(saveData)
          .eq('id', editingCustomer.id)

        if (error) throw error
        showNotification('Customer updated successfully', 'success')
      } else {
        // Create new customer
        const { error } = await supabase
          .from('billing_customers')
          .insert([saveData])

        if (error) throw error
        showNotification('Customer created successfully', 'success')
      }

      setShowModal(false)
      loadCustomers()
    } catch (error) {
      console.error('Failed to save customer:', error)
      showNotification('Failed to save customer', 'error')
    }
  }

  async function handleDelete(customer: BillingCustomer) {
    showConfirm(`Are you sure you want to delete ${customer.customer_name}?`, async () => {
      try {
        const { error } = await supabase
          .from('billing_customers')
          .delete()
          .eq('id', customer.id)

        if (error) throw error
        showNotification('Customer deleted successfully', 'success')
        loadCustomers()
      } catch (error) {
        console.error('Failed to delete customer:', error)
        showNotification('Failed to delete customer. They may have associated invoices.', 'error')
      }
    })
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="animate-pulse">
          <div className="h-6 md:h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 md:w-1/4 mb-6 md:mb-8"></div>
          <div className="h-64 md:h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black gradient-text">Customer Management</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1 md:mt-2">Manage billing customers and their settings</p>
        </div>
        <Button onClick={openAddModal} size="sm" className="md:text-base md:px-6 md:py-3">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <CardTitle className="text-base md:text-lg">Customers ({filteredCustomers.length})</CardTitle>
            <div className="w-full sm:w-auto flex items-center gap-4">
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Stripe Status</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Markup</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Invoice</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Created</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 md:py-8 text-gray-500 dark:text-gray-400 text-sm">
                      {searchQuery ? 'No customers found matching your search' : 'No customers yet. Add your first customer to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => viewDetails(customer)}
                    >
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">{customer.customer_name}</td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-gray-900 dark:text-gray-100">{customer.customer_email}</td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm">
                        {customer.stripe_customer_id ? (
                          <Badge color="green">Connected</Badge>
                        ) : (
                          <Badge color="gray">Not Connected</Badge>
                        )}
                      </td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-gray-900 dark:text-gray-100">{customer.markup_percentage || 0}%</td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm">
                        {customer.auto_invoice_enabled ? (
                          <Badge color="blue">Enabled</Badge>
                        ) : (
                          <Badge color="gray">Disabled</Badge>
                        )}
                      </td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-gray-900 dark:text-gray-100">{formatDate(customer.created_at)}</td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(customer)
                            }}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-500"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(customer)
                            }}
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

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title="Customer Details"
          size="xl"
        >
          <div className="space-y-6">
            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-black gradient-text mb-3">Customer Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Customer Name</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.customer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Contact Name</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.billing_contact_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Phone Number</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.phone_number || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Billing Address</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.billing_address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tax ID</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.tax_id || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Billing Settings */}
            <div>
              <h3 className="text-lg font-black gradient-text mb-3">Billing Settings</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Markup Percentage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedCustomer.markup_percentage || 0}%</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Auto-Invoice</p>
                  <div className="mt-1">
                    {selectedCustomer.auto_invoice_enabled ? (
                      <Badge color="blue">Enabled</Badge>
                    ) : (
                      <Badge color="gray">Disabled</Badge>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Stripe Status</p>
                  <div className="mt-1">
                    {selectedCustomer.stripe_customer_id ? (
                      <Badge color="green">Connected</Badge>
                    ) : (
                      <Badge color="gray">Not Connected</Badge>
                    )}
                  </div>
                </div>
              </div>
              {selectedCustomer.stripe_customer_id && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Stripe Customer ID</p>
                  <p className="font-mono text-xs text-gray-900 dark:text-gray-100">{selectedCustomer.stripe_customer_id}</p>
                </div>
              )}
            </div>

            {/* Retell AI Configuration */}
            <div>
              <h3 className="text-lg font-black gradient-text mb-3">Retell AI Configuration</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Voice Agent ID</p>
                    {selectedCustomer.voice_agent_id ? (
                      <Badge color="blue">{selectedCustomer.voice_agent_id}</Badge>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Not configured</p>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">SMS Agent ID</p>
                    {selectedCustomer.sms_agent_id ? (
                      <Badge color="green">{selectedCustomer.sms_agent_id}</Badge>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Not configured</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">API Key</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {selectedCustomer.retell_api_key_encrypted ? '••••••••••••' : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>

            {/* Twilio Phone Numbers */}
            <div>
              <h3 className="text-lg font-black gradient-text mb-3">Twilio Phone Numbers</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Phone Numbers to Track ({selectedCustomer.twilio_phone_numbers?.length || 0})</p>
                  {selectedCustomer.twilio_phone_numbers && selectedCustomer.twilio_phone_numbers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.twilio_phone_numbers.map((phoneNum) => (
                        <Badge key={phoneNum} color="green">{phoneNum}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No phone numbers configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* Vonage Phone Numbers */}
            <div>
              <h3 className="text-lg font-black gradient-text mb-3">Vonage Phone Numbers</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Phone Numbers to Track ({selectedCustomer.vonage_phone_numbers?.length || 0})</p>
                  {selectedCustomer.vonage_phone_numbers && selectedCustomer.vonage_phone_numbers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.vonage_phone_numbers.map((phoneNum) => (
                        <Badge key={phoneNum} color="purple">{phoneNum}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No phone numbers configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedCustomer.notes && (
              <div>
                <h3 className="text-lg font-black gradient-text mb-3">Notes</h3>
                <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">{selectedCustomer.notes}</p>
              </div>
            )}

            {/* Account Details */}
            <div>
              <h3 className="text-lg font-black gradient-text mb-3">Account Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selectedCustomer.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selectedCustomer.updated_at)}</p>
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
                  openEditModal(selectedCustomer)
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Customer
              </Button>
            </div>
          </div>
        </Modal>
      )}

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

          {/* Retell API Configuration */}
          <div>
            <h3 className="text-lg font-black gradient-text mb-3">Retell AI Configuration</h3>
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Input
                label="Retell AI API Key*"
                type="password"
                value={formData.retell_api_key}
                onChange={(e) => setFormData({ ...formData, retell_api_key: e.target.value })}
                placeholder="key_..."
                required
                helperText="This customer's Retell AI API key (encrypted before storage). Required to fetch their call/chat data."
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Voice Agent ID*"
                  value={formData.voice_agent_id}
                  onChange={(e) => setFormData({ ...formData, voice_agent_id: e.target.value })}
                  placeholder="agent_voice_..."
                  required
                  helperText="Agent ID for voice calls"
                />

                <Input
                  label="SMS Agent ID*"
                  value={formData.sms_agent_id}
                  onChange={(e) => setFormData({ ...formData, sms_agent_id: e.target.value })}
                  placeholder="agent_sms_..."
                  required
                  helperText="Agent ID for SMS/text messages"
                />
              </div>
            </div>
          </div>

          {/* Twilio Phone Numbers */}
          <div>
            <h3 className="text-lg font-black gradient-text mb-3">Twilio Phone Numbers</h3>
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Numbers to Track*
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter phone number (e.g., +15551234567)"
                      value={phoneNumberInput}
                      onChange={(e) => setPhoneNumberInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addPhoneNumber()
                        }
                      }}
                    />
                    <Button type="button" onClick={addPhoneNumber}>Add</Button>
                  </div>
                  {formData.twilio_phone_numbers.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {formData.twilio_phone_numbers.map((phoneNum) => (
                        <div
                          key={phoneNum}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm"
                        >
                          <span>{phoneNum}</span>
                          <button
                            type="button"
                            onClick={() => removePhoneNumber(phoneNum)}
                            className="hover:text-green-900 dark:hover:text-green-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Add phone numbers to filter Twilio usage for this customer. Use E.164 format (e.g., +15551234567).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Vonage Phone Numbers */}
          <div>
            <h3 className="text-lg font-black gradient-text mb-3">Vonage Phone Numbers</h3>
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Numbers to Track*
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter phone number (e.g., +15551234567)"
                      value={vonagePhoneNumberInput}
                      onChange={(e) => setVonagePhoneNumberInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addVonagePhoneNumber()
                        }
                      }}
                    />
                    <Button type="button" onClick={addVonagePhoneNumber}>Add</Button>
                  </div>
                  {formData.vonage_phone_numbers.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {formData.vonage_phone_numbers.map((phoneNum) => (
                        <div
                          key={phoneNum}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm"
                        >
                          <span>{phoneNum}</span>
                          <button
                            type="button"
                            onClick={() => removeVonagePhoneNumber(phoneNum)}
                            className="hover:text-purple-900 dark:hover:text-purple-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Add phone numbers to filter Vonage usage for this customer. Use E.164 format (e.g., +15551234567).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-6">
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
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              checked={formData.auto_invoice_enabled}
              onChange={(e) => setFormData({ ...formData, auto_invoice_enabled: e.target.checked })}
            />
            <label htmlFor="auto_invoice" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
