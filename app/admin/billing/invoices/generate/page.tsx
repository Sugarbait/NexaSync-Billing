'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { stripeInvoiceService } from '@/lib/services/stripeInvoiceService'
import { billingCostService } from '@/lib/services/billingCostService'
import type { BillingCustomer, InvoicePreview, InvoiceResult } from '@/lib/types/billing'
import { formatCAD, formatDateRange, getPreviousMonthRange, getCurrentMonthRange } from '@/lib/utils/format'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Step = 'date-range' | 'preview' | 'options' | 'processing' | 'results'

export default function GenerateInvoicesPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('date-range')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(getPreviousMonthRange())
  const [customers, setCustomers] = useState<BillingCustomer[]>([])
  const [previews, setPreviews] = useState<InvoicePreview[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [invoiceMode, setInvoiceMode] = useState<'draft' | 'finalize' | 'send'>('draft')
  const [dueInDays, setDueInDays] = useState(30)
  const [autoCreateStripe, setAutoCreateStripe] = useState(true)
  const [results, setResults] = useState<InvoiceResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    const { data } = await supabase
      .from('billing_customers')
      .select('*')
      .order('customer_name', { ascending: true })

    setCustomers(data || [])
  }

  async function calculatePreviews() {
    setLoading(true)
    try {
      // Get current user ID
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        throw new Error('User not authenticated')
      }

      const previewPromises = customers.map(async (customer) => {
        const costs = await billingCostService.calculateCustomerCosts(customer.id, dateRange, userData.user.id)

        return {
          customerId: customer.id,
          customerName: customer.customer_name,
          totalChats: costs.chatCount,
          totalCalls: costs.callCount,
          totalSegments: costs.totalSegments,
          totalMinutes: costs.totalMinutes,
          twilioSMSCost: costs.twilioSMSCostCAD,
          twilioVoiceCost: costs.twilioVoiceCostCAD,
          retellAICost: costs.retellAIChatCostCAD + costs.retellAIVoiceCostCAD,
          subtotal: costs.subtotal,
          markupPercent: customer.markup_percentage,
          markupAmount: costs.markupAmount,
          total: costs.total,
          hasStripeCustomer: !!customer.stripe_customer_id,
          includeInBatch: true
        } as InvoicePreview
      })

      const calculatedPreviews = await Promise.all(previewPromises)
      setPreviews(calculatedPreviews)

      // Auto-select customers with usage > 0
      const selectedIds = new Set(
        calculatedPreviews
          .filter(p => p.total > 0)
          .map(p => p.customerId)
      )
      setSelectedCustomers(selectedIds)

      setCurrentStep('preview')
    } catch (error) {
      console.error('Failed to calculate previews:', error)
      alert('Failed to calculate invoice previews')
    } finally {
      setLoading(false)
    }
  }

  function toggleCustomer(customerId: string) {
    const newSelected = new Set(selectedCustomers)
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId)
    } else {
      newSelected.add(customerId)
    }
    setSelectedCustomers(newSelected)
  }

  function toggleAll() {
    if (selectedCustomers.size === previews.length) {
      setSelectedCustomers(new Set())
    } else {
      setSelectedCustomers(new Set(previews.map(p => p.customerId)))
    }
  }

  async function generateInvoices() {
    setCurrentStep('processing')
    setLoading(true)

    const selectedPreviews = previews.filter(p => selectedCustomers.has(p.customerId))
    const invoiceResults: InvoiceResult[] = []

    setProgress({ current: 0, total: selectedPreviews.length })

    // Initialize Stripe
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      await stripeInvoiceService.initialize(userData.user.id)
    }

    for (let i = 0; i < selectedPreviews.length; i++) {
      const preview = selectedPreviews[i]
      setProgress({ current: i + 1, total: selectedPreviews.length })

      try {
        const customer = customers.find(c => c.id === preview.customerId)!

        // Check for Stripe customer
        let stripeCustomerId = customer.stripe_customer_id

        if (!stripeCustomerId && autoCreateStripe) {
          const result = await stripeInvoiceService.createCustomer({
            email: customer.customer_email,
            name: customer.customer_name,
            phone: customer.phone_number || undefined,
            metadata: { nexasync_customer_id: customer.id }
          })

          if (result.success && result.customerId) {
            stripeCustomerId = result.customerId

            // Update database
            await supabase
              .from('billing_customers')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', customer.id)
          }
        }

        if (!stripeCustomerId) {
          throw new Error('No Stripe customer ID available')
        }

        // Create line items
        const lineItems = []

        if (preview.twilioSMSCost > 0) {
          lineItems.push({
            description: `SMS Services - ${formatDateRange(dateRange)}\n${preview.totalSegments} segments, ${preview.totalChats} conversations`,
            amount: Math.round(preview.twilioSMSCost * 100),
            currency: 'cad'
          })
        }

        if (preview.twilioVoiceCost > 0) {
          lineItems.push({
            description: `Voice Call Services - ${formatDateRange(dateRange)}\n${preview.totalMinutes.toFixed(1)} minutes, ${preview.totalCalls} calls`,
            amount: Math.round(preview.twilioVoiceCost * 100),
            currency: 'cad'
          })
        }

        if (preview.retellAICost > 0) {
          lineItems.push({
            description: `AI Processing Services - ${formatDateRange(dateRange)}\nConversational AI, speech processing`,
            amount: Math.round(preview.retellAICost * 100),
            currency: 'cad'
          })
        }

        if (preview.markupAmount > 0) {
          lineItems.push({
            description: `Service Markup (${preview.markupPercent}%)`,
            amount: Math.round(preview.markupAmount * 100),
            currency: 'cad'
          })
        }

        // Create Stripe invoice
        const invoiceResult = await stripeInvoiceService.createInvoice({
          stripeCustomerId,
          lineItems,
          dueInDays,
          autoAdvance: invoiceMode !== 'draft',
          metadata: {
            billing_period_start: dateRange.start.toISOString(),
            billing_period_end: dateRange.end.toISOString(),
            nexasync_customer_id: customer.id
          }
        })

        if (!invoiceResult.success || !invoiceResult.invoice) {
          throw new Error(invoiceResult.error || 'Failed to create invoice')
        }

        const invoice = invoiceResult.invoice

        // Finalize if needed
        if (invoiceMode === 'finalize' || invoiceMode === 'send') {
          await stripeInvoiceService.finalizeInvoice(invoice.id)
        }

        // Send if needed
        if (invoiceMode === 'send') {
          await stripeInvoiceService.sendInvoice(invoice.id)
        }

        // Save to database
        const { data: invoiceRecord } = await supabase
          .from('invoice_records')
          .insert({
            billing_customer_id: customer.id,
            stripe_invoice_id: invoice.id,
            invoice_number: invoice.number,
            billing_period_start: dateRange.start.toISOString().split('T')[0],
            billing_period_end: dateRange.end.toISOString().split('T')[0],
            total_chats: preview.totalChats,
            total_calls: preview.totalCalls,
            total_sms_segments: preview.totalSegments,
            total_call_minutes: preview.totalMinutes,
            twilio_sms_cost_cad: preview.twilioSMSCost,
            twilio_voice_cost_cad: preview.twilioVoiceCost,
            retell_ai_chat_cost_cad: preview.retellAICost,
            retell_ai_voice_cost_cad: 0,
            subtotal_cad: preview.subtotal,
            markup_amount_cad: preview.markupAmount,
            total_amount_cad: preview.total,
            invoice_status: invoiceMode === 'draft' ? 'draft' : 'sent',
            stripe_invoice_url: invoice.hosted_invoice_url,
            stripe_invoice_pdf_url: invoice.invoice_pdf,
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString().split('T')[0] : null,
            sent_at: invoiceMode === 'send' ? new Date().toISOString() : null
          })
          .select()
          .single()

        invoiceResults.push({
          success: true,
          customerId: customer.id,
          customerName: customer.customer_name,
          invoiceId: invoice.id,
          amount: preview.total
        })

      } catch (error) {
        console.error(`Failed to generate invoice for ${preview.customerName}:`, error)
        invoiceResults.push({
          success: false,
          customerId: preview.customerId,
          customerName: preview.customerName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    setResults(invoiceResults)
    setCurrentStep('results')
    setLoading(false)
  }

  const selectedPreviews = previews.filter(p => selectedCustomers.has(p.customerId))
  const totalAmount = selectedPreviews.reduce((sum, p) => sum + p.total, 0)
  const missingStripe = selectedPreviews.filter(p => !p.hasStripeCustomer).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/admin/billing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-black gradient-text mt-4">Generate Invoices</h1>
        <p className="text-gray-600 mt-2">Create and send invoices for your customers</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          {['Date Range', 'Preview', 'Options', 'Processing', 'Results'].map((label, index) => {
            const stepValues: Step[] = ['date-range', 'preview', 'options', 'processing', 'results']
            const currentIndex = stepValues.indexOf(currentStep)
            const isActive = index === currentIndex
            const isCompleted = index < currentIndex

            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  isActive ? 'bg-blue-600 text-white' :
                  isCompleted ? 'bg-green-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {label}
                </span>
                {index < 4 && <ArrowRight className="w-4 h-4 mx-4 text-gray-400" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: Date Range */}
      {currentStep === 'date-range' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Billing Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={dateRange === getPreviousMonthRange() ? 'primary' : 'secondary'}
                onClick={() => setDateRange(getPreviousMonthRange())}
              >
                Previous Month
              </Button>
              <Button
                variant={dateRange === getCurrentMonthRange() ? 'primary' : 'secondary'}
                onClick={() => setDateRange(getCurrentMonthRange())}
              >
                Current Month (MTD)
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={dateRange.start.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={dateRange.end.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected Period:</strong> {formatDateRange(dateRange)}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                This will calculate costs for all completed chats and calls in this period.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={calculatePreviews} loading={loading} size="lg">
                Next: Preview Invoices
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {currentStep === 'preview' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Invoice Preview ({selectedPreviews.length} selected)</CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={toggleAll}>
                  {selectedCustomers.size === previews.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.size === previews.length}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Usage</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Costs</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Subtotal</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Markup</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((preview) => (
                    <tr key={preview.customerId} className={`border-b border-gray-100 ${
                      selectedCustomers.has(preview.customerId) ? 'bg-blue-50' : ''
                    }`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.has(preview.customerId)}
                          onChange={() => toggleCustomer(preview.customerId)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">{preview.customerName}</td>
                      <td className="py-3 px-4 text-xs">
                        <div>{preview.totalChats} chats, {preview.totalCalls} calls</div>
                        <div className="text-gray-500">{preview.totalSegments} seg, {preview.totalMinutes.toFixed(1)} min</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div>SMS: {formatCAD(preview.twilioSMSCost)}</div>
                        <div>Voice: {formatCAD(preview.twilioVoiceCost)}</div>
                        <div>AI: {formatCAD(preview.retellAICost)}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{formatCAD(preview.subtotal)}</td>
                      <td className="py-3 px-4 text-sm">{preview.markupPercent}%</td>
                      <td className="py-3 px-4 text-sm font-semibold">{formatCAD(preview.total)}</td>
                      <td className="py-3 px-4 text-sm">
                        {preview.hasStripeCustomer ? (
                          <Badge color="green">Ready</Badge>
                        ) : (
                          <Badge color="yellow">No Stripe ID</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Selected Customers</p>
                  <p className="text-xl font-bold">{selectedPreviews.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-xl font-bold">{formatCAD(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Missing Stripe IDs</p>
                  <p className="text-xl font-bold">{missingStripe}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep('date-range')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('options')}
                disabled={selectedCustomers.size === 0}
                size="lg"
              >
                Next: Configure Options
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Options */}
      {currentStep === 'options' && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Mode</label>
              <div className="space-y-2">
                {[
                  { value: 'draft', label: 'Create Draft Invoices', description: 'Invoices will be created but not sent. You can review before sending.' },
                  { value: 'finalize', label: 'Finalize Invoices (Don\'t Send)', description: 'Invoices will be finalized but not emailed to customers.' },
                  { value: 'send', label: 'Create and Send Invoices', description: 'Invoices will be created and automatically emailed to customers.' }
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`p-4 border rounded-lg cursor-pointer ${
                      invoiceMode === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                    }`}
                    onClick={() => setInvoiceMode(option.value as any)}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        checked={invoiceMode === option.value}
                        onChange={() => setInvoiceMode(option.value as any)}
                        className="mr-3"
                      />
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-sm text-gray-600">{option.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Select
              label="Payment Due Date"
              value={dueInDays}
              onChange={(e) => setDueInDays(parseInt(e.target.value))}
              options={[
                { value: 0, label: 'Due on Receipt' },
                { value: 15, label: 'Net 15 (15 days)' },
                { value: 30, label: 'Net 30 (30 days)' },
                { value: 60, label: 'Net 60 (60 days)' }
              ]}
            />

            {missingStripe > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800">
                      {missingStripe} customer(s) don't have Stripe Customer IDs
                    </p>
                    <div className="mt-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={autoCreateStripe}
                          onChange={(e) => setAutoCreateStripe(e.target.checked)}
                          className="mr-2 rounded"
                        />
                        <span className="text-sm text-yellow-700">
                          Automatically create Stripe customers for them
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep('preview')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={generateInvoices} size="lg">
                Generate {selectedCustomers.size} Invoice{selectedCustomers.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Processing */}
      {currentStep === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle>Generating Invoices...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-lg font-medium">Processing {progress.current} of {progress.total} invoices...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {Math.round((progress.current / progress.total) * 100)}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Results */}
      {currentStep === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Generation Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Successfully Created</p>
                <p className="text-2xl font-bold text-green-600">
                  {results.filter(r => r.success).length}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {results.filter(r => !r.success).length}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCAD(results.filter(r => r.success).reduce((sum, r) => sum + (r.amount || 0), 0))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.customerId}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    result.success ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                    )}
                    <div>
                      <p className="font-medium">{result.customerName}</p>
                      {!result.success && result.error && (
                        <p className="text-sm text-red-600">{result.error}</p>
                      )}
                    </div>
                  </div>
                  {result.success && result.amount && (
                    <p className="font-semibold">{formatCAD(result.amount)}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="secondary" onClick={() => router.push('/admin/billing')}>
                Back to Dashboard
              </Button>
              <Button onClick={() => router.push('/admin/billing/invoices')}>
                View Invoice History
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
