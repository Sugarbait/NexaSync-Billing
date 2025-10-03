'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Search, Download, Eye, Send, CheckCircle, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { stripeInvoiceService } from '@/lib/services/stripeInvoiceService'
import type { InvoiceRecord } from '@/lib/types/billing'
import { formatCAD, formatDate, convertToCSV, downloadFile } from '@/lib/utils/format'

interface InvoiceWithCustomer extends InvoiceRecord {
  billing_customers?: {
    customer_name: string
    customer_email: string
  } | null
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceWithCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithCustomer | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadInvoices()
  }, [])

  const filterInvoices = useCallback(() => {
    let filtered = invoices

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.invoice_status === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(query) ||
        inv.billing_customers?.customer_name?.toLowerCase().includes(query) ||
        inv.billing_customers?.customer_email?.toLowerCase().includes(query)
      )
    }

    setFilteredInvoices(filtered)
  }, [invoices, statusFilter, searchQuery])

  useEffect(() => {
    filterInvoices()
  }, [filterInvoices])

  async function loadInvoices() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('invoice_records')
        .select(`
          *,
          billing_customers(customer_name, customer_email)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Failed to load invoices:', error)
      alert('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status: string): 'gray' | 'blue' | 'green' | 'red' | 'yellow' {
    const colors: Record<string, 'gray' | 'blue' | 'green' | 'red' | 'yellow'> = {
      draft: 'gray',
      sent: 'blue',
      paid: 'green',
      overdue: 'red',
      cancelled: 'gray'
    }
    return colors[status] || 'gray'
  }

  function viewDetails(invoice: InvoiceWithCustomer) {
    setSelectedInvoice(invoice)
    setShowDetailModal(true)
  }

  async function sendInvoice(invoice: InvoiceWithCustomer) {
    if (!confirm(`Send invoice to ${invoice.billing_customers?.customer_name}?`)) return

    try {
      if (!invoice.stripe_invoice_id) {
        throw new Error('No Stripe invoice ID found')
      }

      const result = await stripeInvoiceService.sendInvoice(invoice.stripe_invoice_id)
      if (!result.success) throw new Error(result.error)

      // Update database
      await supabase
        .from('invoice_records')
        .update({
          invoice_status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', invoice.id)

      alert('Invoice sent successfully')
      loadInvoices()
    } catch (error) {
      console.error('Failed to send invoice:', error)
      alert(`Failed to send invoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async function markAsPaid(invoice: InvoiceWithCustomer) {
    if (!confirm(`Mark invoice as paid for ${invoice.billing_customers?.customer_name}?`)) return

    try {
      await supabase
        .from('invoice_records')
        .update({
          invoice_status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoice.id)

      alert('Invoice marked as paid')
      loadInvoices()
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error)
      alert('Failed to mark invoice as paid')
    }
  }

  function exportToCSV() {
    const csvData = filteredInvoices.map(invoice => ({
      'Invoice Number': invoice.invoice_number || invoice.stripe_invoice_id?.slice(0, 8) || 'N/A',
      'Date Created': formatDate(invoice.created_at),
      'Customer Name': invoice.billing_customers?.customer_name || 'N/A',
      'Customer Email': invoice.billing_customers?.customer_email || 'N/A',
      'Period Start': formatDate(invoice.billing_period_start),
      'Period End': formatDate(invoice.billing_period_end),
      'Total Chats': invoice.total_chats || 0,
      'Total Calls': invoice.total_calls || 0,
      'SMS Segments': invoice.total_sms_segments || 0,
      'Call Minutes': (invoice.total_call_minutes || 0).toFixed(1),
      'Twilio SMS Cost (CAD)': (invoice.twilio_sms_cost_cad || 0).toFixed(2),
      'Twilio Voice Cost (CAD)': (invoice.twilio_voice_cost_cad || 0).toFixed(2),
      'Retell AI Chat Cost (CAD)': (invoice.retell_ai_chat_cost_cad || 0).toFixed(2),
      'Retell AI Voice Cost (CAD)': (invoice.retell_ai_voice_cost_cad || 0).toFixed(2),
      'Subtotal (CAD)': (invoice.subtotal_cad || 0).toFixed(2),
      'Markup Amount (CAD)': (invoice.markup_amount_cad || 0).toFixed(2),
      'Total Amount (CAD)': (invoice.total_amount_cad || 0).toFixed(2),
      'Status': invoice.invoice_status,
      'Sent Date': invoice.sent_at ? formatDate(invoice.sent_at) : '',
      'Paid Date': invoice.paid_at ? formatDate(invoice.paid_at) : ''
    }))

    const csv = convertToCSV(csvData)
    downloadFile(csv, `invoices_${Date.now()}.csv`, 'text/csv')
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
          <h1 className="text-3xl font-black gradient-text">Invoice History</h1>
          <p className="text-gray-600 mt-2">View and manage all invoices</p>
        </div>
        <Button onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
            <div className="flex flex-col md:flex-row gap-4">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'sent', label: 'Sent' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'cancelled', label: 'Cancelled' }
                ]}
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search invoices..."
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Invoice #</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Period</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Usage</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {searchQuery || statusFilter !== 'all'
                        ? 'No invoices found matching your filters'
                        : 'No invoices yet. Generate your first invoice to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {invoice.invoice_number || invoice.stripe_invoice_id?.slice(0, 8) || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{formatDate(invoice.created_at)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {invoice.billing_customers?.customer_name || 'Unknown Customer'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                        <div className="text-xs">
                          <div>{invoice.total_chats || 0} chats</div>
                          <div className="text-gray-500 dark:text-gray-400">{invoice.total_sms_segments || 0} segments</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCAD(Number(invoice.total_amount_cad || 0))}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <Badge color={getStatusColor(invoice.invoice_status)}>
                          {invoice.invoice_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewDetails(invoice)}
                            className="text-blue-600 hover:text-blue-700"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {invoice.invoice_status === 'draft' && (
                            <button
                              onClick={() => sendInvoice(invoice)}
                              className="text-green-600 hover:text-green-700"
                              title="Send Invoice"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.invoice_status === 'sent' && (
                            <button
                              onClick={() => markAsPaid(invoice)}
                              className="text-green-600 hover:text-green-700"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.stripe_invoice_url && (
                            <a
                              href={invoice.stripe_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 hover:text-gray-700"
                              title="View in Stripe"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
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

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Invoice ${selectedInvoice.invoice_number || 'Details'}`}
          size="xl"
        >
          <div className="space-y-6">
            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Customer Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer Name</p>
                  <p className="font-medium">{selectedInvoice.billing_customers?.customer_name || 'Unknown Customer'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{selectedInvoice.billing_customers?.customer_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Billing Period</p>
                  <p className="font-medium">
                    {formatDate(selectedInvoice.billing_period_start)} - {formatDate(selectedInvoice.billing_period_end)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge color={getStatusColor(selectedInvoice.invoice_status)}>
                    {selectedInvoice.invoice_status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Usage Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Usage Summary</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Chats</p>
                  <p className="text-2xl font-bold">{selectedInvoice.total_chats || 0}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-2xl font-bold">{selectedInvoice.total_calls || 0}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">SMS Segments</p>
                  <p className="text-2xl font-bold">{selectedInvoice.total_sms_segments || 0}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Call Minutes</p>
                  <p className="text-2xl font-bold">{(selectedInvoice.total_call_minutes || 0).toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Cost Breakdown</h3>
              <table className="w-full">
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2">Twilio SMS Services</td>
                    <td className="py-2 text-right">{formatCAD(Number(selectedInvoice.twilio_sms_cost_cad || 0))}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Twilio Voice Services</td>
                    <td className="py-2 text-right">{formatCAD(Number(selectedInvoice.twilio_voice_cost_cad || 0))}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Retell AI Chat Services</td>
                    <td className="py-2 text-right">{formatCAD(Number(selectedInvoice.retell_ai_chat_cost_cad || 0))}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Retell AI Voice Services</td>
                    <td className="py-2 text-right">{formatCAD(Number(selectedInvoice.retell_ai_voice_cost_cad || 0))}</td>
                  </tr>
                  <tr className="border-t-2">
                    <td className="py-2 font-semibold">Subtotal</td>
                    <td className="py-2 text-right font-semibold">{formatCAD(Number(selectedInvoice.subtotal_cad || 0))}</td>
                  </tr>
                  {(selectedInvoice.markup_amount_cad || 0) > 0 && (
                    <tr>
                      <td className="py-2">Service Markup</td>
                      <td className="py-2 text-right">{formatCAD(Number(selectedInvoice.markup_amount_cad || 0))}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-black">
                    <td className="py-2 font-bold text-lg">Total</td>
                    <td className="py-2 text-right font-bold text-lg">{formatCAD(Number(selectedInvoice.total_amount_cad || 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              {selectedInvoice.stripe_invoice_url && (
                <Button
                  variant="secondary"
                  onClick={() => selectedInvoice.stripe_invoice_url && window.open(selectedInvoice.stripe_invoice_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View in Stripe
                </Button>
              )}
              {selectedInvoice.invoice_status === 'draft' && (
                <Button onClick={() => {
                  setShowDetailModal(false)
                  sendInvoice(selectedInvoice)
                }}>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invoice
                </Button>
              )}
              {selectedInvoice.invoice_status === 'sent' && (
                <Button onClick={() => {
                  setShowDetailModal(false)
                  markAsPaid(selectedInvoice)
                }}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Paid
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
