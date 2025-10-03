'use client'

import React, { useState, useEffect } from 'react'
import { Save, TestTube, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { stripeInvoiceService } from '@/lib/services/stripeInvoiceService'
import type { BillingSettings } from '@/lib/types/billing'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null)
  const [settings, setSettings] = useState<Partial<BillingSettings>>({
    stripe_test_mode: true,
    default_markup_percentage: 0,
    default_due_date_days: 30,
    default_invoice_note: '',
    invoice_footer_text: '',
    notification_email: '',
    notify_on_invoice_generated: true,
    notify_on_payment_received: true
  })
  const [stripeApiKey, setStripeApiKey] = useState('')
  const [stripePublishableKey, setStripePublishableKey] = useState('')
  const [retellApiKey, setRetellApiKey] = useState('')
  const [twilioAccountSid, setTwilioAccountSid] = useState('')
  const [twilioAuthToken, setTwilioAuthToken] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data, error } = await supabase
        .from('billing_settings')
        .select('*')
        .eq('user_id', userData.user.id)
        .single()

      if (data) {
        setSettings(data)
        setStripePublishableKey(data.stripe_publishable_key || '')
      } else if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned", which is fine for first time
        console.error('Failed to load settings:', error)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      // Encrypt Stripe API key if provided
      let encryptedStripeKey = settings.stripe_api_key_encrypted
      if (stripeApiKey) {
        encryptedStripeKey = await stripeInvoiceService.encryptApiKey(stripeApiKey)
      }

      // Encrypt Retell API key if provided
      let encryptedRetellKey = settings.retell_api_key_encrypted
      if (retellApiKey) {
        encryptedRetellKey = await stripeInvoiceService.encryptApiKey(retellApiKey)
      }

      // Encrypt Twilio credentials if provided
      let encryptedTwilioSid = settings.twilio_account_sid_encrypted
      let encryptedTwilioToken = settings.twilio_auth_token_encrypted
      if (twilioAccountSid) {
        encryptedTwilioSid = await stripeInvoiceService.encryptApiKey(twilioAccountSid)
      }
      if (twilioAuthToken) {
        encryptedTwilioToken = await stripeInvoiceService.encryptApiKey(twilioAuthToken)
      }

      const settingsToSave = {
        ...settings,
        user_id: userData.user.id,
        stripe_api_key_encrypted: encryptedStripeKey,
        stripe_publishable_key: stripePublishableKey,
        retell_api_key_encrypted: encryptedRetellKey,
        twilio_account_sid_encrypted: encryptedTwilioSid,
        twilio_auth_token_encrypted: encryptedTwilioToken
      }

      const { error } = await supabase
        .from('billing_settings')
        .upsert(settingsToSave, {
          onConflict: 'user_id'
        })

      if (error) throw error

      alert('Settings saved successfully')
      setStripeApiKey('') // Clear for security
      setRetellApiKey('') // Clear for security
      setTwilioAccountSid('') // Clear for security
      setTwilioAuthToken('') // Clear for security
      loadSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTestingConnection(true)
    setConnectionResult(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      await stripeInvoiceService.initialize(userData.user.id)
      const result = await stripeInvoiceService.testConnection()
      setConnectionResult(result)
    } catch (error) {
      setConnectionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      })
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text">Billing Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Configure Stripe integration and invoice defaults</p>
      </div>

      <div className="space-y-6">
        {/* Stripe Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Stripe Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Your Stripe API keys are encrypted and stored securely. Test mode allows you to
                test invoice generation without creating real charges.
              </p>
            </div>

            <Input
              label="Stripe Secret Key"
              type="password"
              value={stripeApiKey}
              onChange={(e) => setStripeApiKey(e.target.value)}
              placeholder="sk_test_... or sk_live_..."
              helperText="Your Stripe Secret Key (starts with sk_). Leave blank to keep existing key."
            />

            <Input
              label="Stripe Publishable Key"
              value={stripePublishableKey}
              onChange={(e) => setStripePublishableKey(e.target.value)}
              placeholder="pk_test_... or pk_live_..."
              helperText="Your Stripe Publishable Key (starts with pk_)"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={settings.stripe_test_mode}
                    onChange={() => setSettings({ ...settings, stripe_test_mode: true })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">🧪 Test Mode (No real charges)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!settings.stripe_test_mode}
                    onChange={() => setSettings({ ...settings, stripe_test_mode: false })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">⚡ Live Mode (Real invoices and charges)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="secondary"
                onClick={testConnection}
                loading={testingConnection}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Test Connection
              </Button>
              <Button onClick={saveSettings} loading={saving}>
                <Save className="w-4 h-4 mr-2" />
                Save Stripe Settings
              </Button>
            </div>

            {connectionResult && (
              <div className={`p-4 rounded-lg border ${
                connectionResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center">
                  {connectionResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                  )}
                  <p className={`text-sm ${
                    connectionResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                  }`}>
                    {connectionResult.message}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Default Markup Percentage"
              type="number"
              min="0"
              max="10000"
              step="0.1"
              value={settings.default_markup_percentage || 0}
              onChange={(e) => setSettings({
                ...settings,
                default_markup_percentage: parseFloat(e.target.value)
              })}
              helperText="Default markup applied to all new customers (can be overridden per customer)"
            />

            <Select
              label="Payment Terms"
              value={settings.default_due_date_days || 30}
              onChange={(e) => setSettings({
                ...settings,
                default_due_date_days: parseInt(e.target.value)
              })}
              options={[
                { value: 0, label: 'Due on Receipt' },
                { value: 15, label: 'Net 15 (15 days)' },
                { value: 30, label: 'Net 30 (30 days)' },
                { value: 60, label: 'Net 60 (60 days)' },
                { value: 90, label: 'Net 90 (90 days)' }
              ]}
            />

            <Textarea
              label="Default Invoice Note"
              value={settings.default_invoice_note || ''}
              onChange={(e) => setSettings({
                ...settings,
                default_invoice_note: e.target.value
              })}
              rows={3}
              placeholder="Thank you for your business..."
              helperText="This note will appear on all invoices"
            />

            <Textarea
              label="Invoice Footer"
              value={settings.invoice_footer_text || ''}
              onChange={(e) => setSettings({
                ...settings,
                invoice_footer_text: e.target.value
              })}
              rows={2}
              placeholder="NexaSync Billing | www.nexasync.com | support@nexasync.com"
              helperText="Footer text displayed at bottom of invoices"
            />

            <Button onClick={saveSettings} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Invoice Defaults
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Notification Email"
              type="email"
              value={settings.notification_email || ''}
              onChange={(e) => setSettings({
                ...settings,
                notification_email: e.target.value
              })}
              placeholder="billing@example.com"
              helperText="Email address to receive billing notifications"
            />

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.notify_on_invoice_generated}
                  onChange={(e) => setSettings({
                    ...settings,
                    notify_on_invoice_generated: e.target.checked
                  })}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Send email summary when invoices are created</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.notify_on_payment_received}
                  onChange={(e) => setSettings({
                    ...settings,
                    notify_on_payment_received: e.target.checked
                  })}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Send email when Stripe reports payment received</span>
              </label>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Note: Payment notifications require Stripe webhook configuration (Phase 2)
            </p>

            <Button onClick={saveSettings} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Notification Settings
            </Button>
          </CardContent>
        </Card>

        {/* Twilio Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Twilio Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Configure Twilio API to automatically fetch SMS and Voice usage data with actual costs.
              </p>
            </div>

            <Input
              label="Twilio Account SID"
              type="password"
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
              placeholder="AC... (Your Twilio Account SID)"
              helperText="Your Twilio Account SID will be encrypted and stored securely. Leave blank to keep existing."
            />

            <Input
              label="Twilio Auth Token"
              type="password"
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
              placeholder="Enter your Twilio Auth Token"
              helperText="Your Twilio Auth Token will be encrypted and stored securely. Leave blank to keep existing."
            />

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.twilio_api_enabled}
                  onChange={(e) => setSettings({ ...settings, twilio_api_enabled: e.target.checked })}
                  className="mr-2 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enable Twilio API integration for automatic cost calculation</span>
              </label>
            </div>

            <Button onClick={saveSettings} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Twilio Settings
            </Button>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Automatic Invoice Generation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️ Automation is currently in development. Manual invoice generation is recommended.
              </p>
            </div>

            <div className="opacity-50 pointer-events-none">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  disabled
                  className="mr-2 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Automatically generate invoices monthly (Coming in Phase 2)</span>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
