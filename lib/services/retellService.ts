/**
 * Enhanced Retell AI Service for Billing Platform
 * Adapted from CareXPS CRM with complete API implementation
 */

export interface RetellCall {
  call_id: string
  agent_id: string
  call_type: 'web_call' | 'phone_call'
  call_status: 'registered' | 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  duration_ms?: number
  transcript?: string
  recording_url?: string
  call_analysis?: {
    call_summary?: string
    user_sentiment?: 'positive' | 'negative' | 'neutral'
    call_successful?: boolean
    custom_analysis_data?: any
  }
  call_cost?: {
    product_costs: Array<{
      product: string
      unit_price: number
      cost: number
    }>
    combined_cost: number
  }
  telephony_identifier?: {
    twilio_call_sid?: string
  }
  metadata?: any
  disconnection_reason?: string
  from_number?: string
  to_number?: string
  call_length_seconds?: number
  // Legacy support
  call_duration?: number
  cost?: {
    llm: number
    stt: number
    tts: number
    total: number
  }
}

export interface RetellChat {
  chat_id: string
  agent_id: string
  chat_status: 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  transcript?: string
  message_with_tool_calls: Array<{
    message_id: string
    role: 'agent' | 'user'
    content: string
    created_timestamp: number
  }>
  chat_analysis?: {
    chat_summary?: string
    user_sentiment?: string
    chat_successful?: boolean
    custom_analysis_data?: any
  }
  chat_cost?: {
    product_costs: Array<{
      product: string
      unit_price: number
      cost: number
    }>
    combined_cost: number
  }
  metadata?: any
  // Legacy support
  messages?: any[]
}

export interface CallListResponse {
  calls: RetellCall[]
  pagination_key?: string
  has_more: boolean
}

export interface ChatListResponse {
  chats: RetellChat[]
  pagination_key?: string
  has_more: boolean
}

class RetellService {
  private baseUrl = 'https://api.retellai.com'
  private apiKey: string = ''
  private isInitialized = false

  /**
   * Initialize with API key
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey
    this.isInitialized = true
    console.log('Retell AI service initialized')
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.isInitialized && !!this.apiKey
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    if (!this.apiKey) {
      throw new Error('Retell AI API key not configured')
    }

    return {
      'Authorization': `Bearer ${this.apiKey.trim()}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Get calls for specific agent IDs in a date range
   */
  async getCallsForAgents(
    agentIds: string[],
    startTimestamp: number,
    endTimestamp: number
  ): Promise<RetellCall[]> {
    if (!this.isConfigured()) {
      throw new Error('Retell AI not initialized')
    }

    const allCalls: RetellCall[] = []

    for (const agentId of agentIds) {
      try {
        const response = await this.getCallHistory({
          agent_id: agentId,
          start_timestamp: { gte: startTimestamp, lte: endTimestamp },
          limit: 1000
        })
        allCalls.push(...response.calls)
      } catch (error) {
        console.error(`Failed to fetch calls for agent ${agentId}:`, error)
      }
    }

    return allCalls
  }

  /**
   * Get chats for specific agent IDs in a date range
   */
  async getChatsForAgents(
    agentIds: string[],
    startTimestamp: number,
    endTimestamp: number
  ): Promise<RetellChat[]> {
    if (!this.isConfigured()) {
      throw new Error('Retell AI not initialized')
    }

    const allChats: RetellChat[] = []

    for (const agentId of agentIds) {
      try {
        const response = await this.getChatHistory({
          agent_id: agentId,
          start_timestamp: { gte: startTimestamp, lte: endTimestamp },
          limit: 1000
        })
        allChats.push(...response.chats)
      } catch (error) {
        console.error(`Failed to fetch chats for agent ${agentId}:`, error)
      }
    }

    return allChats
  }

  /**
   * Fetch call history
   */
  async getCallHistory(options: {
    limit?: number
    agent_id?: string
    start_timestamp?: { gte?: number; lte?: number }
  } = {}): Promise<CallListResponse> {
    if (!this.isConfigured()) {
      throw new Error('Retell AI not initialized')
    }

    const requestBody: any = {
      sort_order: 'descending',
      limit: Math.min(options.limit || 1000, 1000)
    }

    const filterCriteria: any = {}

    if (options.agent_id) {
      filterCriteria.agent_id = [options.agent_id]
    }

    if (options.start_timestamp) {
      const timestamp: any = {}
      if (options.start_timestamp.gte) {
        timestamp.lower_threshold = options.start_timestamp.gte * 1000
      }
      if (options.start_timestamp.lte) {
        timestamp.upper_threshold = options.start_timestamp.lte * 1000
      }
      filterCriteria.start_timestamp = timestamp
    }

    if (Object.keys(filterCriteria).length > 0) {
      requestBody.filter_criteria = filterCriteria
    }

    const response = await fetch(`${this.baseUrl}/v2/list-calls`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch calls: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    let calls: RetellCall[] = []
    let pagination_key: string | undefined = undefined
    let has_more = false

    if (Array.isArray(data)) {
      calls = data
      has_more = data.length >= (options.limit || 200)
    } else if (data && typeof data === 'object') {
      calls = data.calls || data.data || []
      pagination_key = data.pagination_key
      has_more = data.has_more || !!pagination_key
    }

    return {
      calls,
      pagination_key,
      has_more
    }
  }

  /**
   * Fetch chat history
   */
  async getChatHistory(options: {
    limit?: number
    agent_id?: string
    start_timestamp?: { gte?: number; lte?: number }
  } = {}): Promise<ChatListResponse> {
    if (!this.isConfigured()) {
      throw new Error('Retell AI not initialized')
    }

    let url = `${this.baseUrl}/list-chat`
    const params = new URLSearchParams()

    if (options.agent_id) {
      params.append('agent_id', options.agent_id)
    }

    params.append('limit', (options.limit || 1000).toString())

    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch chats: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    let chats: RetellChat[] = []
    let pagination_key: string | undefined = undefined
    let has_more = false

    if (Array.isArray(data)) {
      chats = data
      has_more = data.length >= 1000
    } else if (data && typeof data === 'object') {
      chats = data.chats || data.data || []
      pagination_key = data.pagination_key
      has_more = data.has_more || !!pagination_key
    }

    // Filter by timestamp if provided
    if (options.start_timestamp) {
      chats = chats.filter(chat => {
        const timestamp = chat.start_timestamp
        if (options.start_timestamp!.gte && timestamp < options.start_timestamp!.gte) {
          return false
        }
        if (options.start_timestamp!.lte && timestamp > options.start_timestamp!.lte) {
          return false
        }
        return true
      })
    }

    return {
      chats,
      pagination_key,
      has_more
    }
  }

  /**
   * Calculate call metrics for analytics
   */
  calculateCallMetrics(calls: RetellCall[]) {
    const totalCalls = calls.length
    const completedCalls = calls.filter(call => call.call_status === 'ended')
    const failedCalls = calls.filter(call => call.call_status === 'error')

    const totalDuration = completedCalls.reduce((sum, call) => {
      if (call.duration_ms) {
        return sum + (call.duration_ms / 1000)
      }
      return sum
    }, 0)

    const avgDuration = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0

    const totalCost = calls.reduce((sum, call) => {
      const costCents = call.call_cost?.combined_cost || 0
      return sum + (costCents / 100)
    }, 0)

    const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0

    return {
      totalCalls,
      completedCalls: completedCalls.length,
      failedCalls: failedCalls.length,
      avgDuration,
      totalDuration,
      totalCost,
      avgCostPerCall,
      totalMinutes: Math.round(totalDuration / 60)
    }
  }

  /**
   * Test Retell API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key not configured' }
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/list-calls`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          limit: 1,
          sort_order: 'descending'
        })
      })

      if (response.ok) {
        return { success: true, message: 'Connected successfully' }
      } else {
        const errorText = await response.text()
        return {
          success: false,
          message: `API error: ${response.status} - ${errorText}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }
}

export const retellService = new RetellService()
// Legacy exports for compatibility
export type { RetellCall as RetellCallData, RetellChat as RetellChatData }
