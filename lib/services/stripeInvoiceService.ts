import Stripe from 'stripe'
import { supabase } from '../supabase'

class StripeInvoiceService {
  private stripe: Stripe | null = null
  private testMode: boolean = true

  /**
   * Initialize Stripe with API keys from settings
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Load Stripe settings from database
      const { data: settings, error } = await supabase
        .from('billing_settings')
        .select('stripe_api_key_encrypted, stripe_test_mode')
        .eq('user_id', userId)
        .single()

      if (error || !settings || !settings.stripe_api_key_encrypted) {
        console.warn('No Stripe API key configured')
        return false
      }

      // Decrypt API key
      const apiKey = await this.decryptApiKey(settings.stripe_api_key_encrypted)

      this.stripe = new Stripe(apiKey, {
        apiVersion: '2025-09-30.clover',
        typescript: true
      })

      this.testMode = settings.stripe_test_mode

      console.log('Stripe initialized:', this.testMode ? 'Test Mode' : 'Live Mode')
      return true

    } catch (error) {
      console.error('Failed to initialize Stripe:', error)
      return false
    }
  }

  /**
   * Test Stripe connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.stripe) {
      return { success: false, message: 'Stripe not initialized' }
    }

    try {
      await this.stripe.customers.list({ limit: 1 })

      return {
        success: true,
        message: `Connected successfully (${this.testMode ? 'Test Mode' : 'Live Mode'})`
      }
    } catch (error) {
      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        return { success: false, message: 'Invalid API key' }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  /**
   * Create Stripe customer
   */
  async createCustomer(customerData: {
    email: string
    name: string
    phone?: string
    address?: string
    metadata?: Record<string, string>
  }): Promise<{ success: boolean; customerId?: string; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address ? {
          line1: customerData.address
        } : undefined,
        metadata: {
          ...customerData.metadata,
          nexasync_created_at: new Date().toISOString()
        }
      })

      return { success: true, customerId: customer.id }

    } catch (error) {
      console.error('Failed to create Stripe customer:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer'
      }
    }
  }

  /**
   * Create invoice with line items
   */
  async createInvoice(params: {
    stripeCustomerId: string
    lineItems: Array<{
      description: string
      amount: number // In cents
      currency: string
    }>
    dueInDays: number
    metadata?: Record<string, string>
    autoAdvance?: boolean
  }): Promise<{ success: boolean; invoice?: Stripe.Invoice; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      // Create invoice
      const invoice = await this.stripe.invoices.create({
        customer: params.stripeCustomerId,
        collection_method: 'send_invoice',
        days_until_due: params.dueInDays,
        auto_advance: params.autoAdvance ?? false,
        metadata: params.metadata || {}
      })

      // Add line items
      for (const item of params.lineItems) {
        await this.stripe.invoiceItems.create({
          customer: params.stripeCustomerId,
          invoice: invoice.id,
          description: item.description,
          amount: item.amount,
          currency: item.currency
        })
      }

      return { success: true, invoice }

    } catch (error) {
      console.error('Failed to create invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invoice'
      }
    }
  }

  /**
   * Finalize invoice (make it immutable and ready to send)
   */
  async finalizeInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.finalizeInvoice(invoiceId)
      return { success: true }

    } catch (error) {
      console.error('Failed to finalize invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize invoice'
      }
    }
  }

  /**
   * Send invoice to customer
   */
  async sendInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.sendInvoice(invoiceId)
      return { success: true }

    } catch (error) {
      console.error('Failed to send invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invoice'
      }
    }
  }

  /**
   * Mark invoice as paid (manually)
   */
  async markInvoiceAsPaid(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.pay(invoiceId, {
        paid_out_of_band: true // Mark as paid outside of Stripe
      })
      return { success: true }

    } catch (error) {
      console.error('Failed to mark invoice as paid:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as paid'
      }
    }
  }

  /**
   * Void/cancel invoice
   */
  async voidInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripe) {
      return { success: false, error: 'Stripe not initialized' }
    }

    try {
      await this.stripe.invoices.voidInvoice(invoiceId)
      return { success: true }

    } catch (error) {
      console.error('Failed to void invoice:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to void invoice'
      }
    }
  }

  /**
   * Decrypt API key from storage
   * TODO: Implement proper encryption/decryption
   */
  async decryptApiKey(encrypted: string): Promise<string> {
    // For now, assume it's base64 encoded
    // In production, use proper encryption (AES-256-GCM)
    try {
      return Buffer.from(encrypted, 'base64').toString('utf-8')
    } catch {
      // If not base64, assume it's plain text (for dev purposes)
      return encrypted
    }
  }

  /**
   * Encrypt API key for storage
   */
  async encryptApiKey(plaintext: string): Promise<string> {
    // For now, use base64 encoding
    // In production, use proper encryption (AES-256-GCM)
    return Buffer.from(plaintext, 'utf-8').toString('base64')
  }
}

export const stripeInvoiceService = new StripeInvoiceService()
