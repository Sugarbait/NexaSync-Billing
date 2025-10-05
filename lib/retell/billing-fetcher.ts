// Retell AI Billing Data Fetcher
// Fetches call and message data from Retell AI for billing purposes

interface BillingPeriod {
  startDate: Date
  endDate: Date
}

interface RetellCall {
  call_id: string
  agent_id: string
  call_type: 'web_call' | 'phone_call' | 'inbound_call'
  call_status: 'registered' | 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp: number
  duration_ms: number
  from_number: string
  to_number: string
  transcript_object?: {
    transcript: Array<{
      role: 'agent' | 'user'
      content: string
      timestamp: number
    }>
  }
  metadata?: Record<string, any>
}

interface RetellCallResponse {
  calls: RetellCall[]
  has_more: boolean
  last_call_id?: string
}

interface RetellMessage {
  message_id: string
  agent_id: string
  conversation_id: string
  timestamp: number
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  body: string
  segment_count: number
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  cost?: number
  cost_unit?: string
}

interface RetellMessageResponse {
  messages: RetellMessage[]
  has_more: boolean
  last_message_id?: string
}

interface UsageData {
  calls: {
    total: number
    totalMinutes: number
    totalCost: number
    breakdown: Array<{
      call_id: string
      duration_ms: number
      duration_minutes: number
      timestamp: Date
      from_number: string
      to_number: string
    }>
  }
  messages: {
    total: number
    totalSegments: number
    totalCost: number
    breakdown: Array<{
      message_id: string
      segments: number
      timestamp: Date
      direction: 'inbound' | 'outbound'
    }>
  }
}

interface PricingConfig {
  costPerMinute: number
  costPerSmsSegment: number
}

class RetellAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'RetellAPIError'
  }
}

export class RetellBillingFetcher {
  private apiKey: string
  private baseUrl = 'https://api.retellai.com/v2'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Fetch all calls for a billing period with pagination support
   */
  async fetchAllCalls(
    agentId: string,
    period: BillingPeriod
  ): Promise<RetellCall[]> {
    let allCalls: RetellCall[] = []
    let hasMore = true
    let lastCallId: string | undefined

    while (hasMore) {
      const params = new URLSearchParams({
        agent_id: agentId,
        start_timestamp: Math.floor(period.startDate.getTime() / 1000).toString(),
        end_timestamp: Math.floor(period.endDate.getTime() / 1000).toString(),
        limit: '100',
        sort_order: 'ascending'
      })

      if (lastCallId) {
        params.append('after_call_id', lastCallId)
      }

      try {
        const response = await this.fetchWithRetry(
          `${this.baseUrl}/list-calls?${params}`
        )

        const data: RetellCallResponse = await response.json()
        allCalls = allCalls.concat(data.calls)
        hasMore = data.has_more
        lastCallId = data.last_call_id

        // Rate limiting: wait between requests
        if (hasMore) {
          await this.sleep(100)
        }
      } catch (error) {
        console.error('Error fetching calls:', error)
        throw error
      }
    }

    return allCalls
  }

  /**
   * Fetch all messages for a billing period with pagination
   */
  async fetchAllMessages(
    agentId: string,
    period: BillingPeriod
  ): Promise<RetellMessage[]> {
    let allMessages: RetellMessage[] = []
    let hasMore = true
    let lastMessageId: string | undefined

    while (hasMore) {
      const params = new URLSearchParams({
        agent_id: agentId,
        start_timestamp: Math.floor(period.startDate.getTime() / 1000).toString(),
        end_timestamp: Math.floor(period.endDate.getTime() / 1000).toString(),
        limit: '100'
      })

      if (lastMessageId) {
        params.append('after_message_id', lastMessageId)
      }

      try {
        const response = await this.fetchWithRetry(
          `${this.baseUrl}/list-messages?${params}`
        )

        const data: RetellMessageResponse = await response.json()
        allMessages = allMessages.concat(data.messages)
        hasMore = data.has_more
        lastMessageId = data.last_message_id

        if (hasMore) {
          await this.sleep(100)
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
        throw error
      }
    }

    return allMessages
  }

  /**
   * Calculate usage data for billing
   */
  async calculateUsage(
    voiceAgentId: string,
    smsAgentId: string,
    period: BillingPeriod,
    pricing: PricingConfig
  ): Promise<UsageData> {
    // Fetch calls and messages in parallel
    const [calls, messages] = await Promise.all([
      this.fetchAllCalls(voiceAgentId, period),
      this.fetchAllMessages(smsAgentId, period)
    ])

    // Calculate call metrics
    const callBreakdown = calls
      .filter(call => call.call_status === 'ended') // Only count completed calls
      .map(call => ({
        call_id: call.call_id,
        duration_ms: call.duration_ms,
        duration_minutes: call.duration_ms / 1000 / 60,
        timestamp: new Date(call.start_timestamp * 1000),
        from_number: call.from_number,
        to_number: call.to_number
      }))

    const totalMinutes = callBreakdown.reduce(
      (sum, call) => sum + call.duration_minutes,
      0
    )

    const callCost = totalMinutes * pricing.costPerMinute

    // Calculate message metrics
    const messageBreakdown = messages
      .filter(msg => msg.status === 'delivered' || msg.status === 'sent')
      .map(msg => ({
        message_id: msg.message_id,
        segments: msg.segment_count || 1,
        timestamp: new Date(msg.timestamp * 1000),
        direction: msg.direction
      }))

    const totalSegments = messageBreakdown.reduce(
      (sum, msg) => sum + msg.segments,
      0
    )

    const messageCost = totalSegments * pricing.costPerSmsSegment

    return {
      calls: {
        total: callBreakdown.length,
        totalMinutes: Math.round(totalMinutes * 100) / 100,
        totalCost: Math.round(callCost * 100) / 100,
        breakdown: callBreakdown
      },
      messages: {
        total: messageBreakdown.length,
        totalSegments,
        totalCost: Math.round(messageCost * 100) / 100,
        breakdown: messageBreakdown
      }
    }
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  private async fetchWithRetry(
    url: string,
    maxRetries: number = 3
  ): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
          console.warn(`Rate limited. Retrying after ${retryAfter}s`)
          await this.sleep(retryAfter * 1000)
          continue
        }

        // Handle server errors with exponential backoff
        if (response.status >= 500) {
          const delay = Math.pow(2, attempt) * 1000
          console.warn(`Server error. Retrying in ${delay}ms`)
          await this.sleep(delay)
          continue
        }

        // Handle client errors
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))

          switch (response.status) {
            case 401:
              throw new RetellAPIError(401, 'Invalid API key', errorBody)
            case 403:
              throw new RetellAPIError(403, 'Insufficient permissions', errorBody)
            case 404:
              throw new RetellAPIError(404, 'Resource not found', errorBody)
            default:
              throw new RetellAPIError(
                response.status,
                `API request failed: ${response.statusText}`,
                errorBody
              )
          }
        }

        return response
      } catch (error) {
        if (error instanceof RetellAPIError) throw error

        if (attempt === maxRetries - 1) {
          throw new Error(`Network error after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }

        await this.sleep(Math.pow(2, attempt) * 1000)
      }
    }

    throw new Error('Max retries exceeded')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Generate monthly usage report for a customer
 */
export async function generateMonthlyUsageReport(
  customerId: string,
  customerRetellApiKey: string,
  voiceAgentId: string,
  smsAgentId: string,
  year: number,
  month: number // 0-indexed (0 = January)
) {
  const fetcher = new RetellBillingFetcher(customerRetellApiKey)

  // Define billing period (full month)
  const startDate = new Date(year, month, 1, 0, 0, 0)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59)

  const period: BillingPeriod = { startDate, endDate }

  // Define pricing (these should come from your billing settings)
  const pricing: PricingConfig = {
    costPerMinute: 0.10, // $0.10 per minute
    costPerSmsSegment: 0.015 // $0.015 per SMS segment
  }

  try {
    const usage = await fetcher.calculateUsage(
      voiceAgentId,
      smsAgentId,
      period,
      pricing
    )

    console.log('Usage Report:', {
      customerId,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      calls: {
        count: usage.calls.total,
        minutes: usage.calls.totalMinutes,
        cost: `$${usage.calls.totalCost.toFixed(2)}`
      },
      messages: {
        count: usage.messages.total,
        segments: usage.messages.totalSegments,
        cost: `$${usage.messages.totalCost.toFixed(2)}`
      },
      totalCost: `$${(usage.calls.totalCost + usage.messages.totalCost).toFixed(2)}`
    })

    return usage
  } catch (error) {
    console.error('Failed to generate usage report:', error)
    throw error
  }
}

// Export types
export type { BillingPeriod, UsageData, PricingConfig, RetellCall, RetellMessage }
