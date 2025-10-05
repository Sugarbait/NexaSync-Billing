'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DollarSign, Users, FileText, TrendingUp, Building2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { ParticleBackground } from '@/components/ui/ParticleBackground'
import { formatCAD, formatDate, formatDateRange, getPreviousMonthRange, getCurrentMonthRange } from '@/lib/utils/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import type { InvoiceRecord, BillingCustomer, MonthlyTrend } from '@/lib/types/billing'
import Link from 'next/link'

export default function BillingDashboard() {
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [customers, setCustomers] = useState<BillingCustomer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(getCurrentMonthRange())
  const loadDashboardDataRef = useRef<() => Promise<void>>()
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

  async function loadCustomers() {
    try {
      const { data } = await supabase
        .from('billing_customers')
        .select('*')
        .order('customer_name', { ascending: true })

      setCustomers(data || [])
    } catch (error) {
      console.error('Failed to load customers:', error)
      setCustomers([])
    }
  }

  const loadDashboardData = useCallback(async () => {
    if (initialLoad) {
      setLoading(true)
    }
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
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      if (initialLoad) {
        setLoading(false)
        setInitialLoad(false)
      }
    }
  }, [selectedCustomerId, customers, dateRange, initialLoad])

  // Keep ref updated with latest loadDashboardData
  useEffect(() => {
    loadDashboardDataRef.current = loadDashboardData
  }, [loadDashboardData])

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardDataRef.current?.()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, []) // No dependencies - interval never recreated

  async function loadCurrentMonthRevenue() {
    try {
      let query = supabase
        .from('invoice_records')
        .select('total_amount_cad')
        .gte('billing_period_start', dateRange.start.toISOString().split('T')[0])
        .lte('billing_period_end', dateRange.end.toISOString().split('T')[0])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { data } = await query
      const total = data?.reduce((sum, inv) => sum + Number(inv.total_amount_cad), 0) || 0
      setStats(prev => ({ ...prev, currentMonthRevenue: total }))
    } catch {
      setStats(prev => ({ ...prev, currentMonthRevenue: 0 }))
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
      const total = data?.reduce((sum, inv) => sum + Number(inv.total_amount_cad), 0) || 0
      setStats(prev => ({ ...prev, previousMonthRevenue: total }))
    } catch {
      setStats(prev => ({ ...prev, previousMonthRevenue: 0 }))
    }
  }

  async function loadCustomerCount() {
    try {
      if (selectedCustomerId === 'all') {
        const { count } = await supabase
          .from('billing_customers')
          .select('*', { count: 'exact', head: true })
        setStats(prev => ({ ...prev, totalCustomers: count || 0 }))
      } else {
        setStats(prev => ({ ...prev, totalCustomers: 1 }))
      }
    } catch {
      setStats(prev => ({ ...prev, totalCustomers: 0 }))
    }
  }

  async function loadPendingInvoices() {
    try {
      let query = supabase
        .from('invoice_records')
        .select('*', { count: 'exact', head: true })
        .in('invoice_status', ['draft', 'sent'])
        .gte('billing_period_start', dateRange.start.toISOString().split('T')[0])
        .lte('billing_period_end', dateRange.end.toISOString().split('T')[0])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { count } = await query
      setStats(prev => ({ ...prev, pendingInvoices: count || 0 }))
    } catch {
      setStats(prev => ({ ...prev, pendingInvoices: 0 }))
    }
  }

  async function loadRecentInvoices() {
    let query = supabase
      .from('invoice_records')
      .select(`
        *,
        billing_customers!inner(customer_name, customer_email)
      `)
      .gte('billing_period_start', dateRange.start.toISOString().split('T')[0])
      .lte('billing_period_end', dateRange.end.toISOString().split('T')[0])
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
      let query = supabase
        .from('invoice_records')
        .select('twilio_sms_cost_cad, twilio_voice_cost_cad, retell_ai_cost_cad')
        .gte('billing_period_start', dateRange.start.toISOString().split('T')[0])
        .lte('billing_period_end', dateRange.end.toISOString().split('T')[0])

      if (selectedCustomerId !== 'all') {
        query = query.eq('billing_customer_id', selectedCustomerId)
      }

      const { data } = await query

      const twilioSMS = data?.reduce((sum, inv) => sum + Number(inv.twilio_sms_cost_cad || 0), 0) || 0
      const twilioVoice = data?.reduce((sum, inv) => sum + Number(inv.twilio_voice_cost_cad || 0), 0) || 0
      const retellAI = data?.reduce((sum, inv) => sum + Number(inv.retell_ai_cost_cad || 0), 0) || 0
      const total = twilioSMS + twilioVoice + retellAI

      setStats(prev => ({
        ...prev,
        currentMonthCosts: { twilioSMS, twilioVoice, retellAI, total }
      }))
    } catch (error) {
      setStats(prev => ({
        ...prev,
        currentMonthCosts: { twilioSMS: 0, twilioVoice: 0, retellAI: 0, total: 0 }
      }))
    }
  }

  async function loadChartData() {
    // TODO: Implement monthly trend calculation from database
    setChartData([])
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
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black gradient-text">Billing Admin</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <RefreshCw className="w-4 h-4" />
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Manage customers, generate invoices, and track revenue • Auto-refreshes every minute</p>
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

        {/* Date Range Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</label>
            <input
              type="date"
              value={dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
            <input
              type="date"
              value={dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                setDateRange({ start: today, end: today })
              }}
            >
              Today
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDateRange(getCurrentMonthRange())}
            >
              This Month
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDateRange(getPreviousMonthRange())}
            >
              Last Month
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const end = new Date()
                const start = new Date()
                start.setMonth(start.getMonth() - 3)
                setDateRange({ start, end })
              }}
            >
              Last 3 Months
            </Button>
          </div>
        </div>
      </div>

      {/* Combined Cost - Large Display */}
      <Card className="mb-8 bg-gradient-to-br from-blue-600 to-purple-600 border-none relative overflow-hidden">
        <ParticleBackground />
        <CardContent className="p-8 relative z-10">
          <div className="text-center">
            <p className="text-white/80 text-lg mb-2">Total Cost ({formatDateRange(dateRange)})</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue (Selected Period)</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Growth vs Previous Period</p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                  {stats.previousMonthRevenue > 0
                    ? `${((stats.currentMonthRevenue - stats.previousMonthRevenue) / stats.previousMonthRevenue * 100).toFixed(1)}%`
                    : '0%'
                  }
                </p>
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
          <CardTitle>Revenue by Company (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
              <p>No revenue data available yet. Start by adding customers and generating invoices.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                <XAxis dataKey="month" className="fill-gray-700 dark:fill-gray-300" />
                <YAxis tickFormatter={(value) => `$${value}`} className="fill-gray-700 dark:fill-gray-300" />
                <Tooltip
                  formatter={(value) => `${formatCAD(Number(value))}`}
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-primary)'
                  }}
                  labelStyle={{
                    color: 'var(--text-primary)'
                  }}
                  itemStyle={{
                    color: 'var(--text-primary)'
                  }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                <Bar dataKey="sunriseMedical" stackId="a" fill="#3B82F6" name="Sunrise Medical Clinic" />
                <Bar dataKey="valleyDental" stackId="a" fill="#6366F1" name="Valley Dental Group" />
                <Bar dataKey="wellnessChiro" stackId="a" fill="#10B981" name="Wellness Chiropractic" />
                <Bar dataKey="pediatricAssoc" stackId="a" fill="#F59E0B" name="Pediatric Associates" />
              </BarChart>
            </ResponsiveContainer>
          )}
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
