import { supabase } from '../supabase'
import { twilioService } from './twilioService'
import { retellService } from './retellService'
import { twilioCostService } from './twilioCostService'
import { currencyService } from './currencyService'
import { stripeInvoiceService } from './stripeInvoiceService'
import type { CostBreakdown } from '../types/billing'

/**
 * Enhanced Billing Cost Service
 * Integrates with Twilio and Retell AI APIs using CareXPS calculation logic
 */
class BillingCostService {

  /**
   * Initialize API services with credentials from settings
   */
  async initializeServices(userId: string): Promise<void> {
    const { data: settings } = await supabase
      .from('billing_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!settings) return

    // Initialize Twilio if enabled
    if (settings.twilio_api_enabled && settings.twilio_account_sid_encrypted && settings.twilio_auth_token_encrypted) {
      try {
        const accountSid = await stripeInvoiceService.decryptApiKey(settings.twilio_account_sid_encrypted)
        const authToken = await stripeInvoiceService.decryptApiKey(settings.twilio_auth_token_encrypted)
        twilioService.initialize(accountSid, authToken)
      } catch (error) {
        console.error('Failed to initialize Twilio service:', error)
      }
    }

    // Initialize Retell if enabled
    if (settings.retell_api_enabled && settings.retell_api_key_encrypted) {
      try {
        const apiKey = await stripeInvoiceService.decryptApiKey(settings.retell_api_key_encrypted)
        retellService.initialize(apiKey)
      } catch (error) {
        console.error('Failed to initialize Retell service:', error)
      }
    }
  }

  /**
   * Calculate combined SMS and voice costs for a customer in a date range
   */
  async calculateCustomerCosts(
    customerId: string,
    dateRange: { start: Date; end: Date },
    userId: string
  ): Promise<CostBreakdown> {
    // Initialize API services
    await this.initializeServices(userId)

    const startTimestamp = Math.floor(dateRange.start.getTime() / 1000)
    const endTimestamp = Math.floor(dateRange.end.getTime() / 1000)

    // Get customer with Retell Agent IDs
    const { data: customer } = await supabase
      .from('billing_customers')
      .select('markup_percentage, retell_agent_ids, phone_number')
      .eq('id', customerId)
      .single()

    if (!customer) {
      throw new Error('Customer not found')
    }

    const agentIds = customer.retell_agent_ids || []
    let chatCount = 0
    let callCount = 0
    let totalSegments = 0
    let totalMinutes = 0
    let twilioSMSCostUSD = 0
    let twilioVoiceCostUSD = 0
    let retellAIChatCostUSD = 0
    let retellAIVoiceCostUSD = 0

    // Fetch Twilio costs if configured
    if (twilioService.isConfigured()) {
      try {
        const breakdown = await twilioService.calculateCostBreakdown(
          dateRange.start,
          dateRange.end,
          customer.phone_number || undefined
        )
        totalSegments = breakdown.totalSegments
        totalMinutes = breakdown.totalMinutes
        twilioSMSCostUSD = breakdown.smsCostUSD
        twilioVoiceCostUSD = breakdown.voiceCostUSD
      } catch (error) {
        console.error('Failed to fetch Twilio costs:', error)
      }
    } else {
      // Use calculated costs if Twilio API not configured
      // This would need actual message/call data from Retell AI
      console.warn('Twilio API not configured - using calculated costs')
    }

    // Fetch Retell AI costs if configured
    if (retellService.isConfigured() && agentIds.length > 0) {
      try {
        const [calls, chats] = await Promise.all([
          retellService.getCallsForAgents(agentIds, startTimestamp, endTimestamp),
          retellService.getChatsForAgents(agentIds, startTimestamp, endTimestamp)
        ])

        callCount = calls.length
        chatCount = chats.length

        // Sum Retell AI costs
        for (const call of calls) {
          retellAIVoiceCostUSD += call.cost?.total || 0
        }

        for (const chat of chats) {
          retellAIChatCostUSD += chat.chat_cost?.combined_cost || 0
        }
      } catch (error) {
        console.error('Failed to fetch Retell AI costs:', error)
      }
    }

    // Convert USD to CAD using currency service
    const twilioSMSCostCAD = currencyService.convertUSDToCAD(twilioSMSCostUSD)
    const twilioVoiceCostCAD = currencyService.convertUSDToCAD(twilioVoiceCostUSD)
    const retellAIChatCostCAD = currencyService.convertUSDToCAD(retellAIChatCostUSD)
    const retellAIVoiceCostCAD = currencyService.convertUSDToCAD(retellAIVoiceCostUSD)

    const subtotal = twilioSMSCostCAD + twilioVoiceCostCAD + retellAIChatCostCAD + retellAIVoiceCostCAD
    const markupAmount = subtotal * ((customer.markup_percentage || 0) / 100)
    const total = subtotal + markupAmount

    return {
      chatCount,
      callCount,
      totalSegments,
      totalMinutes,
      twilioSMSCostCAD,
      twilioVoiceCostCAD,
      retellAIChatCostCAD,
      retellAIVoiceCostCAD,
      subtotal,
      markupAmount,
      total
    }
  }

  /**
   * Calculate costs for a billing period (all customers)
   */
  async calculatePeriodCosts(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number
    chatCount: number
    callCount: number
    twilioSMSCost: number
    twilioVoiceCost: number
    retellAICost: number
  }> {
    // TODO: Implement aggregated cost calculation
    // This should query all chats/calls in the period and sum costs

    return {
      totalRevenue: 0,
      chatCount: 0,
      callCount: 0,
      twilioSMSCost: 0,
      twilioVoiceCost: 0,
      retellAICost: 0
    }
  }

  /**
   * Calculate SMS cost based on segment count (using twilioCostService)
   */
  async calculateSMSCost(segments: number): Promise<number> {
    // Create dummy messages array for cost calculation
    const messages = Array(segments).fill({ content: 'X'.repeat(160) })
    return twilioCostService.getSMSCostCAD(messages)
  }

  /**
   * Calculate voice call cost based on duration (using twilioCostService)
   */
  async calculateVoiceCost(durationSeconds: number): Promise<number> {
    return twilioCostService.getTwilioCostCAD(durationSeconds)
  }

  /**
   * Get current exchange rate from currency service
   */
  getCurrentExchangeRate(): number {
    return currencyService.getCurrentRate()
  }

  /**
   * Format cost for display
   */
  formatCostCAD(amount: number): string {
    return currencyService.formatCAD(amount)
  }
}

export const billingCostService = new BillingCostService()
