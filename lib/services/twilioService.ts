/**
 * Twilio API Service
 * For fetching SMS and Voice usage records with actual costs
 */

interface TwilioUsageRecord {
  category: string
  count: string
  count_unit: string
  description: string
  price: string
  price_unit: string
  start_date: string
  end_date: string
  usage: string
  usage_unit: string
}

interface TwilioMessageRecord {
  sid: string
  date_created: string
  date_sent: string
  date_updated: string
  direction: string
  from: string
  to: string
  price: string
  price_unit: string
  status: string
  num_segments: string
  body: string
}

interface TwilioCallRecord {
  sid: string
  date_created: string
  start_time: string
  end_time: string
  duration: string
  from: string
  to: string
  price: string
  price_unit: string
  status: string
}

interface TwilioCostBreakdown {
  totalSMS: number
  totalCalls: number
  totalSegments: number
  totalMinutes: number
  smsCostUSD: number
  voiceCostUSD: number
  totalCostUSD: number
}

class TwilioService {
  private accountSid: string | null = null
  private authToken: string | null = null
  private baseUrl = 'https://api.twilio.com/2010-04-01'

  /**
   * Initialize Twilio API with credentials from settings
   */
  initialize(accountSid: string, authToken: string) {
    this.accountSid = accountSid
    this.authToken = authToken
  }

  /**
   * Check if Twilio API is configured
   */
  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken)
  }

  /**
   * Get authorization headers for Twilio API
   */
  private getAuthHeaders(): HeadersInit {
    if (!this.accountSid || !this.authToken) {
      throw new Error('Twilio credentials not configured')
    }

    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Fetch SMS messages for a date range
   */
  async getMessages(
    startDate: Date,
    endDate: Date,
    phoneNumber?: string
  ): Promise<TwilioMessageRecord[]> {
    if (!this.isConfigured()) {
      throw new Error('Twilio API not configured')
    }

    try {
      // If phone number is provided, fetch both sent and received messages
      if (phoneNumber) {
        const [fromMessages, toMessages] = await Promise.all([
          this.fetchMessagesByFilter(startDate, endDate, 'From', phoneNumber),
          this.fetchMessagesByFilter(startDate, endDate, 'To', phoneNumber)
        ])

        // Combine and deduplicate by SID
        const allMessages = [...fromMessages, ...toMessages]
        const uniqueMessages = Array.from(
          new Map(allMessages.map(msg => [msg.sid, msg])).values()
        )
        return uniqueMessages
      } else {
        // No phone filter - get all messages
        return this.fetchMessagesByFilter(startDate, endDate)
      }
    } catch (error) {
      console.error('Failed to fetch messages from Twilio:', error)
      throw error
    }
  }

  /**
   * Helper to fetch messages with specific filter
   */
  private async fetchMessagesByFilter(
    startDate: Date,
    endDate: Date,
    filterType?: 'From' | 'To',
    phoneNumber?: string
  ): Promise<TwilioMessageRecord[]> {
    const url = new URL(`${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`)

    // Add date filters
    url.searchParams.append('DateSent>', startDate.toISOString())
    url.searchParams.append('DateSent<', endDate.toISOString())

    // Filter by phone number if provided
    if (filterType && phoneNumber) {
      url.searchParams.append(filterType, phoneNumber)
    }

    const response = await fetch(url.toString(), {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.messages || []
  }

  /**
   * Fetch voice calls for a date range
   */
  async getCalls(
    startDate: Date,
    endDate: Date,
    phoneNumber?: string
  ): Promise<TwilioCallRecord[]> {
    if (!this.isConfigured()) {
      throw new Error('Twilio API not configured')
    }

    try {
      // If phone number is provided, fetch both outbound and inbound calls
      if (phoneNumber) {
        const [fromCalls, toCalls] = await Promise.all([
          this.fetchCallsByFilter(startDate, endDate, 'From', phoneNumber),
          this.fetchCallsByFilter(startDate, endDate, 'To', phoneNumber)
        ])

        // Combine and deduplicate by SID
        const allCalls = [...fromCalls, ...toCalls]
        const uniqueCalls = Array.from(
          new Map(allCalls.map(call => [call.sid, call])).values()
        )
        return uniqueCalls
      } else {
        // No phone filter - get all calls
        return this.fetchCallsByFilter(startDate, endDate)
      }
    } catch (error) {
      console.error('Failed to fetch calls from Twilio:', error)
      throw error
    }
  }

  /**
   * Helper to fetch calls with specific filter
   */
  private async fetchCallsByFilter(
    startDate: Date,
    endDate: Date,
    filterType?: 'From' | 'To',
    phoneNumber?: string
  ): Promise<TwilioCallRecord[]> {
    const url = new URL(`${this.baseUrl}/Accounts/${this.accountSid}/Calls.json`)

    // Add date filters
    url.searchParams.append('StartTime>', startDate.toISOString())
    url.searchParams.append('StartTime<', endDate.toISOString())

    // Filter by phone number if provided
    if (filterType && phoneNumber) {
      url.searchParams.append(filterType, phoneNumber)
    }

    const response = await fetch(url.toString(), {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.calls || []
  }

  /**
   * Get usage records with pricing for a date range
   * This provides aggregated cost data directly from Twilio
   */
  async getUsageRecords(
    startDate: Date,
    endDate: Date
  ): Promise<TwilioUsageRecord[]> {
    if (!this.isConfigured()) {
      throw new Error('Twilio API not configured')
    }

    try {
      const url = new URL(`${this.baseUrl}/Accounts/${this.accountSid}/Usage/Records.json`)

      // Format dates as YYYY-MM-DD
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      url.searchParams.append('StartDate', startStr)
      url.searchParams.append('EndDate', endStr)

      const response = await fetch(url.toString(), {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.usage_records || []
    } catch (error) {
      console.error('Failed to fetch usage records from Twilio:', error)
      throw error
    }
  }

  /**
   * Calculate cost breakdown for a specific phone number or all usage
   */
  async calculateCostBreakdown(
    startDate: Date,
    endDate: Date,
    phoneNumber?: string
  ): Promise<TwilioCostBreakdown> {
    const [messages, calls] = await Promise.all([
      this.getMessages(startDate, endDate, phoneNumber),
      this.getCalls(startDate, endDate, phoneNumber)
    ])

    // Calculate SMS costs
    let totalSegments = 0
    let smsCostUSD = 0

    for (const message of messages) {
      const segments = parseInt(message.num_segments) || 1
      const price = Math.abs(parseFloat(message.price) || 0)
      totalSegments += segments
      smsCostUSD += price
    }

    // Calculate voice costs
    let totalMinutes = 0
    let voiceCostUSD = 0

    for (const call of calls) {
      const duration = parseInt(call.duration) || 0
      const price = Math.abs(parseFloat(call.price) || 0)
      totalMinutes += Math.ceil(duration / 60) // Round up to minutes
      voiceCostUSD += price
    }

    return {
      totalSMS: messages.length,
      totalCalls: calls.length,
      totalSegments,
      totalMinutes,
      smsCostUSD,
      voiceCostUSD,
      totalCostUSD: smsCostUSD + voiceCostUSD
    }
  }

  /**
   * Get phone numbers associated with the account
   */
  async getPhoneNumbers(): Promise<Array<{ sid: string; phoneNumber: string; friendlyName: string }>> {
    if (!this.isConfigured()) {
      throw new Error('Twilio API not configured')
    }

    try {
      const url = `${this.baseUrl}/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`

      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.statusText}`)
      }

      const data = await response.json()
      return (data.incoming_phone_numbers || []).map((num: any) => ({
        sid: num.sid,
        phoneNumber: num.phone_number,
        friendlyName: num.friendly_name
      }))
    } catch (error) {
      console.error('Failed to fetch phone numbers from Twilio:', error)
      throw error
    }
  }

  /**
   * Test Twilio API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Twilio credentials not configured' }
    }

    try {
      const url = `${this.baseUrl}/Accounts/${this.accountSid}.json`

      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          message: `Connected successfully to account: ${data.friendly_name || this.accountSid}`
        }
      } else {
        return {
          success: false,
          message: `Failed to connect: ${response.statusText}`
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

export const twilioService = new TwilioService()
export type { TwilioUsageRecord, TwilioMessageRecord, TwilioCallRecord, TwilioCostBreakdown }
