'use client'

import React, { useState, useEffect } from 'react'
import { DollarSign, Users, FileText, TrendingUp, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { formatCAD, formatDate, getPreviousMonthRange, getCurrentMonthRange } from '@/lib/utils/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import type { InvoiceRecord, BillingCustomer, MonthlyTrend } from '@/lib/types/billing'
import Link from 'next/link'

export default function BillingDashboard() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<BillingCustomer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all')
  const [stats, setStats] = useState({
    currentMonthRevenue: 0,
    previousMonthRevenue: 0,
    totalCustomers: 0,
    pendingInvoices: 0,
    currentMonthCosts: {
      twilioSMS: 0,
      twilioVoice: 0,
      retellAI: 0,
      total: 0
    }
  })
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRecord[]>([])
  const [chartData, setChartData] = useState<MonthlyTrend[]>([])

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (customers.length > 0) {
      loadDashboardData()
    }
  }, [selectedCustomerId, customers])

  async function loadCustomers() {
    try {
      const { data } = await supabase
        .from('billing_customers')
        .select('*')
        .order('customer_name', { ascending: true })

      if (data && data.length > 0) {
        setCustomers(data)
      } else {
        // Use mock data if no database connection
        setCustomers([
          { id: '1', customer_name: 'Acme Corporation', customer_email: 'billing@acme.com', retell_agent_ids: ['agent_1'], markup_percentage: 20, auto_invoice_enabled: true, created_at: '2024-01-15' },
          { id: '2', customer_name: 'Tech Innovations Inc', customer_email: 'accounts@techinnovations.com', retell_agent_ids: ['agent_2'], markup_percentage: 15, auto_invoice_enabled: true, created_at: '2024-02-20' },
          { id: '3', customer_name: 'Global Solutions Ltd', customer_email: 'finance@globalsolutions.com', retell_agent_ids: ['agent_3'], markup_percentage: 25, auto_invoice_enabled: false, created_at: '2024-03-10' }
        ] as any)
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
      // Use mock data on error
      setCustomers([
        { id: '1', customer_name: 'Acme Corporation', customer_email: 'billing@acme.com', retell_agent_ids: ['agent_1'], markup_percentage: 20, auto_invoice_enabled: true, created_at: '2024-01-15' },
        { id: '2', customer_name: 'Tech Innovations Inc', customer_email: 'accounts@techinnovations.com', retell_agent_ids: ['agent_2'], markup_percentage: 15, auto_invoice_enabled: true, created_at: '2024-02-20' },
        { id: '3', customer_name: 'Global Solutions Ltd', customer_email: 'finance@globalsolutions.com', retell_agent_ids: ['agent_3'], markup_percentage: 25, auto_invoice_enabled: false, created_at: '2024-03-10' }
      ] as any)
    }
  }

  async function loadDashboardData() {
    setLoading(true)
    try {
      // Load stats
      await Promise.all([
        loadCurrentMonthRevenue(),
        loadPreviousMonthRevenue(),
        loadCustomerCount(),
        loadPendingInvoices(),
        loadRecentInvoices(),
        loadChartData(),
        loadCurrentMonthCosts()
      ])
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadCurrentMonthRevenue() {
    try {
      const { start, end } = getCurrentMonthRange()
      let query = supabase
        .from('invoice_records')
        .select('total_amount_cad')
        .gte('billing_period_start', start.toISOString().split('T')[0])
        .lte('billing_period_end', end.toISOString().split('T')[0])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { data } = await query
      const total = data?.reduce((sum, inv) => sum + Number(inv.total_amount_cad), 0) || (selectedCustomerId === 'all' ? 8695.80 : 3145.80)
      setStats(prev => ({ ...prev, currentMonthRevenue: total }))
    } catch {
      setStats(prev => ({ ...prev, currentMonthRevenue: selectedCustomerId === 'all' ? 8695.80 : 3145.80 }))
    }
  }

  async function loadPreviousMonthRevenue() {
    try {
      const { start, end } = getPreviousMonthRange()
      let query = supabase
        .from('invoice_records')
        .select('total_amount_cad')
        .gte('billing_period_start', start.toISOString().split('T')[0])
        .lte('billing_period_end', end.toISOString().split('T')[0])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { data } = await query
      const total = data?.reduce((sum, inv) => sum + Number(inv.total_amount_cad), 0) || (selectedCustomerId === 'all' ? 7834.25 : 2890.50)
      setStats(prev => ({ ...prev, previousMonthRevenue: total }))
    } catch {
      setStats(prev => ({ ...prev, previousMonthRevenue: selectedCustomerId === 'all' ? 7834.25 : 2890.50 }))
    }
  }

  async function loadCustomerCount() {
    try {
      if (selectedCustomerId === 'all') {
        const { count } = await supabase
          .from('billing_customers')
          .select('*', { count: 'exact', head: true })
        setStats(prev => ({ ...prev, totalCustomers: count || 3 }))
      } else {
        setStats(prev => ({ ...prev, totalCustomers: 1 }))
      }
    } catch {
      setStats(prev => ({ ...prev, totalCustomers: selectedCustomerId === 'all' ? 3 : 1 }))
    }
  }

  async function loadPendingInvoices() {
    try {
      let query = supabase
        .from('invoice_records')
        .select('*', { count: 'exact', head: true })
        .in('invoice_status', ['draft', 'sent'])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { count } = await query
      setStats(prev => ({ ...prev, pendingInvoices: count || (selectedCustomerId === 'all' ? 5 : 2) }))
    } catch {
      setStats(prev => ({ ...prev, pendingInvoices: selectedCustomerId === 'all' ? 5 : 2 }))
    }
  }

  async function loadRecentInvoices() {
    let query = supabase
      .from('invoice_records')
      .select(`
        *,
        billing_customers!inner(customer_name, customer_email)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (selectedCustomerId !== 'all') {
      query = query.eq('billing_customer_id', selectedCustomerId)
    }

    const { data } = await query
    setRecentInvoices((data as any) || [])
  }

  async function loadCurrentMonthCosts() {
    try {
      const { start, end } = getCurrentMonthRange()
      let query = supabase
        .from('invoice_records')
        .select('twilio_sms_cost_cad, twilio_voice_cost_cad, retell_ai_cost_cad')
        .gte('billing_period_start', start.toISOString().split('T')[0])
        .lte('billing_period_end', end.toISOString().split('T')[0])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { data } = await query

      if (data && data.length > 0) {
        const twilioSMS = data.reduce((sum, inv) => sum + Number(inv.twilio_sms_cost_cad || 0), 0)
        const twilioVoice = data.reduce((sum, inv) => sum + Number(inv.twilio_voice_cost_cad || 0), 0)
        const retellAI = data.reduce((sum, inv) => sum + Number(inv.retell_ai_cost_cad || 0), 0)
        const total = twilioSMS + twilioVoice + retellAI

        setStats(prev => ({
          ...prev,
          currentMonthCosts: { twilioSMS, twilioVoice, retellAI, total }
        }))
      } else {
        // Mock data
        const mockCosts = selectedCustomerId === 'all'
          ? { twilioSMS: 1850.50, twilioVoice: 3245.75, retellAI: 2150.25, total: 7246.50 }
          : { twilioSMS: 645.25, twilioVoice: 1125.50, retellAI: 850.75, total: 2621.50 }

        setStats(prev => ({
          ...prev,
          currentMonthCosts: mockCosts
        }))
      }
    } catch (error) {
      // Mock data on error
      const mockCosts = selectedCustomerId === 'all'
        ? { twilioSMS: 1850.50, twilioVoice: 3245.75, retellAI: 2150.25, total: 7246.50 }
        : { twilioSMS: 645.25, twilioVoice: 1125.50, retellAI: 850.75, total: 2621.50 }

      setStats(prev => ({
        ...prev,
        currentMonthCosts: mockCosts
      }))
    }
  }

  async function loadChartData() {
    // TODO: Implement monthly trend calculation
    // For now, mock data
    const mockData: MonthlyTrend[] = [
      { month: 'May', twilioSMS: 1200, twilioVoice: 800, retellAI: 1500, total: 3500 },
      { month: 'Jun', twilioSMS: 1400, twilioVoice: 900, retellAI: 1600, total: 3900 },
      { month: 'Jul', twilioSMS: 1300, twilioVoice: 850, retellAI: 1550, total: 3700 },
      { month: 'Aug', twilioSMS: 1600, twilioVoice: 1000, retellAI: 1800, total: 4400 },
      { month: 'Sep', twilioSMS: 1500, twilioVoice: 950, retellAI: 1700, total: 4150 },
      { month: 'Oct', twilioSMS: 1700, twilioVoice: 1100, retellAI: 1900, total: 4700 }
    ]
    setChartData(mockData)
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black gradient-text">Billing Admin</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage customers, generate invoices, and track revenue</p>
        </div>

        {/* Company Selector */}
        <div className="w-72">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            Filter by Company
          </label>
          <Select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            options={[
              { value: 'all', label: 'All Companies' },
              ...customers.map(c => ({
                value: c.id,
                label: c.customer_name
              }))
            ]}
          />
        </div>
      </div>

      {/* Combined Cost - Large Display */}
      <Card className="mb-8 bg-gradient-to-br from-blue-600 to-purple-600 border-none">
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-white/80 text-lg mb-2">Current Month Total Cost</p>
            <p className="text-6xl font-black text-white mb-4">{formatCAD(stats.currentMonthCosts.total)}</p>
            <div className="flex items-center justify-center gap-8 text-white/90">
              <div>
                <p className="text-sm opacity-75">Twilio SMS</p>
                <p className="text-xl font-bold">{formatCAD(stats.currentMonthCosts.twilioSMS)}</p>
              </div>
              <div className="w-px h-12 bg-white/30"></div>
              <div>
                <p className="text-sm opacity-75">Twilio Voice</p>
                <p className="text-xl font-bold">{formatCAD(stats.currentMonthCosts.twilioVoice)}</p>
              </div>
              <div className="w-px h-12 bg-white/30"></div>
              <div>
                <p className="text-sm opacity-75">Retell AI</p>
                <p className="text-xl font-bold">{formatCAD(stats.currentMonthCosts.retellAI)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Month (MTD)</p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCAD(stats.currentMonthRevenue)}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Previous Month</p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCAD(stats.previousMonthRevenue)}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Customers</p>
                <p className="text-4xl font-bold text-gray-700 dark:text-gray-200">{stats.totalCustomers}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Invoices</p>
                <p className="text-4xl font-bold text-gray-700 dark:text-gray-200">{stats.pendingInvoices}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <FileText className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-8">
        <Link href="/admin/billing/invoices/generate">
          <Button size="lg">Generate Monthly Invoices</Button>
        </Link>
        <Link href="/admin/billing/invoices">
          <Button variant="secondary" size="lg">View Invoice History</Button>
        </Link>
        <Link href="/admin/billing/customers">
          <Button variant="secondary" size="lg">Manage Customers</Button>
        </Link>
        <Link href="/admin/billing/settings">
          <Button variant="ghost" size="lg">Settings</Button>
        </Link>
      </div>

      {/* Monthly Trends Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Revenue Trends (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value) => `${formatCAD(Number(value))}`} />
              <Legend />
              <Bar dataKey="twilioSMS" stackId="a" fill="#3B82F6" name="Twilio SMS" />
              <Bar dataKey="twilioVoice" stackId="a" fill="#6366F1" name="Twilio Voice" />
              <Bar dataKey="retellAI" stackId="a" fill="#10B981" name="Retell AI" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Period</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No invoices yet. Generate your first invoice to get started.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">{formatDate(invoice.created_at)}</td>
                      <td className="py-3 px-4 text-sm">{invoice.billing_customers?.customer_name}</td>
                      <td className="py-3 px-4 text-sm">
                        {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">{formatCAD(Number(invoice.total_amount_cad))}</td>
                      <td className="py-3 px-4 text-sm">
                        <Badge color={getStatusColor(invoice.invoice_status)}>
                          {invoice.invoice_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
