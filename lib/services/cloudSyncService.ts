/**
 * Cloud Sync Service for Billing Admin
 * Provides cross-device synchronization for user preferences and settings
 * Implements real-time sync using Supabase
 */

import { supabase } from '@/lib/supabase'

interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  selectedCustomerId?: string
  dateRange?: {
    start: string
    end: string
  }
  dashboardRefreshInterval?: number
  tablePageSize?: number
  notifications?: {
    invoiceGenerated?: boolean
    paymentReceived?: boolean
    customerAdded?: boolean
  }
  lastViewedPage?: string
  favoriteCustomers?: string[]
}

interface SyncData {
  user_id: string
  device_id: string
  preferences: UserPreferences
  last_updated: string
  version: number
}

class CloudSyncService {
  private userId: string | null = null
  private deviceId: string
  private syncEnabled: boolean = true
  private autoSyncInterval: number = 30000 // 30 seconds
  private autoSyncIntervalId: number | null = null
  private realtimeChannel: any = null

  constructor() {
    this.deviceId = this.getOrCreateDeviceId()
    this.initializeSync()
  }

  /**
   * Initialize sync service
   */
  private initializeSync() {
    console.log('CloudSyncService initialized:', {
      deviceId: this.deviceId,
      syncEnabled: this.syncEnabled
    })
  }

  /**
   * Get or create a unique device ID
   */
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('billing_device_id')
    if (!deviceId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        deviceId = `device_${crypto.randomUUID()}`
      } else {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      }
      localStorage.setItem('billing_device_id', deviceId)
    }
    return deviceId
  }

  /**
   * Set user ID and start sync
   */
  public setUserId(userId: string) {
    this.userId = userId
    console.log('CloudSyncService: User ID set to', userId)

    // Check if table exists before starting sync
    this.checkAndInitializeSync()
  }

  /**
   * Check if user_preferences table exists and initialize sync
   */
  private async checkAndInitializeSync() {
    try {
      // Try a simple query to check if table exists
      const { error } = await supabase
        .from('user_preferences')
        .select('user_id')
        .limit(1)

      if (error && error.code === '42P01') {
        console.info('CloudSyncService: Cloud sync disabled - table not found. Run migration to enable.')
        console.info('See CLOUD_SYNC_SETUP.md for setup instructions.')
        return
      }

      // Table exists, start sync
      await this.syncFromCloud()

      if (this.syncEnabled) {
        this.startAutoSync()
        this.setupRealtimeSync()
      }
    } catch (error) {
      console.info('CloudSyncService: Using local storage only')
    }
  }

  /**
   * Sync preferences to cloud
   */
  public async syncToCloud(preferences: UserPreferences): Promise<{ success: boolean; message?: string }> {
    if (!this.userId) {
      return { success: false, message: 'User not authenticated' }
    }

    try {
      const syncData: SyncData = {
        user_id: this.userId,
        device_id: this.deviceId,
        preferences,
        last_updated: new Date().toISOString(),
        version: 1
      }

      // Upsert to Supabase
      const { error } = await supabase
        .from('user_preferences')
        .upsert(syncData, {
          onConflict: 'user_id'
        })

      if (error) {
        // 42P01 = table does not exist (migration not run)
        if (error.code === '42P01') {
          console.warn('CloudSyncService: user_preferences table does not exist. Run the migration in Supabase.')
          // Save to localStorage only
          localStorage.setItem(`preferences_${this.userId}`, JSON.stringify(preferences))
          return { success: true, message: 'Saved locally - table not found' }
        }

        console.warn('CloudSyncService: Sync to cloud error (code: ' + error.code + '):', error.message)
        // Save to localStorage as fallback
        localStorage.setItem(`preferences_${this.userId}`, JSON.stringify(preferences))
        return { success: false, message: error.message }
      }

      // Save to localStorage as cache
      localStorage.setItem(`preferences_${this.userId}`, JSON.stringify(preferences))
      localStorage.setItem(`lastSync_${this.userId}`, new Date().toISOString())

      console.log('CloudSyncService: Preferences synced to cloud')
      return { success: true, message: 'Preferences synced successfully' }
    } catch (error) {
      console.warn('CloudSyncService: Sync to cloud error:', error)
      // Save to localStorage as fallback
      localStorage.setItem(`preferences_${this.userId}`, JSON.stringify(preferences))
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Sync preferences from cloud
   */
  public async syncFromCloud(): Promise<{ success: boolean; preferences?: UserPreferences; message?: string }> {
    if (!this.userId) {
      return { success: false, message: 'User not authenticated' }
    }

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.userId)
        .single()

      // Handle specific error codes
      if (error) {
        // PGRST116 = not found (no preferences yet)
        if (error.code === 'PGRST116') {
          console.log('CloudSyncService: No preferences found in cloud')
          return { success: true, preferences: {}, message: 'No preferences found' }
        }

        // 42P01 = table does not exist (migration not run)
        if (error.code === '42P01') {
          console.warn('CloudSyncService: user_preferences table does not exist. Run the migration in Supabase.')
          // Return success with empty preferences to not break the app
          return { success: true, preferences: {}, message: 'Table not found - migration required' }
        }

        // Log other errors but don't break the app
        console.warn('CloudSyncService: Sync error (code: ' + error.code + '):', error.message)
        return { success: false, message: error.message }
      }

      if (data) {
        const preferences = data.preferences as UserPreferences

        // Save to localStorage as cache
        localStorage.setItem(`preferences_${this.userId}`, JSON.stringify(preferences))
        localStorage.setItem(`lastSync_${this.userId}`, new Date().toISOString())

        console.log('CloudSyncService: Preferences synced from cloud')
        return { success: true, preferences, message: 'Preferences loaded successfully' }
      }

      // No preferences found, return empty
      return { success: true, preferences: {}, message: 'No preferences found' }
    } catch (error) {
      console.warn('CloudSyncService: Sync from cloud error:', error)
      // Return success with empty preferences to not break the app
      return { success: true, preferences: {}, message: 'Sync failed - using local cache' }
    }
  }

  /**
   * Setup real-time sync using Supabase subscriptions
   */
  private setupRealtimeSync() {
    if (!this.userId || this.realtimeChannel) return

    // Subscribe to changes in user_preferences table
    this.realtimeChannel = supabase
      .channel(`user_preferences:${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => {
          console.log('CloudSyncService: Real-time update received', payload)

          // Check if update is from another device
          if (payload.new && payload.new.device_id !== this.deviceId) {
            const preferences = payload.new.preferences as UserPreferences

            // Update localStorage cache
            localStorage.setItem(`preferences_${this.userId}`, JSON.stringify(preferences))

            // Dispatch event to notify components
            window.dispatchEvent(new CustomEvent('cloudPreferencesUpdated', {
              detail: preferences
            }))
          }
        }
      )
      .subscribe()

    console.log('CloudSyncService: Real-time sync enabled')
  }

  /**
   * Start automatic background sync
   */
  public startAutoSync() {
    if (!this.syncEnabled || !this.userId) return

    // Clear existing interval
    this.stopAutoSync()

    this.autoSyncIntervalId = window.setInterval(async () => {
      if (this.userId && this.syncEnabled) {
        try {
          console.log('CloudSyncService: Auto-sync check')
          const result = await this.syncFromCloud()

          if (result.success && result.preferences) {
            // Dispatch event to notify components
            window.dispatchEvent(new CustomEvent('cloudPreferencesUpdated', {
              detail: result.preferences
            }))
          }
        } catch (error) {
          console.error('Auto-sync error:', error)
        }
      }
    }, this.autoSyncInterval)

    console.log('CloudSyncService: Auto-sync started')
  }

  /**
   * Stop automatic sync
   */
  public stopAutoSync() {
    if (this.autoSyncIntervalId !== null) {
      window.clearInterval(this.autoSyncIntervalId)
      this.autoSyncIntervalId = null
      console.log('CloudSyncService: Auto-sync stopped')
    }

    // Unsubscribe from real-time channel
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
      console.log('CloudSyncService: Real-time sync stopped')
    }
  }

  /**
   * Force sync now
   */
  public async forceSyncNow(): Promise<{ success: boolean; message: string }> {
    if (!this.userId) {
      return { success: false, message: 'User not authenticated' }
    }

    try {
      // Get current local preferences
      const localPrefs = localStorage.getItem(`preferences_${this.userId}`)
      if (localPrefs) {
        const preferences = JSON.parse(localPrefs) as UserPreferences
        const result = await this.syncToCloud(preferences)

        if (result.success) {
          return { success: true, message: 'Preferences synced to cloud' }
        } else {
          return { success: false, message: result.message || 'Sync failed' }
        }
      }

      return { success: false, message: 'No local preferences to sync' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): { enabled: boolean; lastSync?: string; deviceId: string } {
    const lastSync = localStorage.getItem(`lastSync_${this.userId}`)
    return {
      enabled: this.syncEnabled,
      lastSync: lastSync || undefined,
      deviceId: this.deviceId
    }
  }

  /**
   * Get cached preferences
   */
  public getCachedPreferences(): UserPreferences | null {
    if (!this.userId) return null

    const cached = localStorage.getItem(`preferences_${this.userId}`)
    if (cached) {
      try {
        return JSON.parse(cached) as UserPreferences
      } catch (error) {
        console.error('Failed to parse cached preferences:', error)
        return null
      }
    }
    return null
  }

  /**
   * Cleanup on logout
   */
  public cleanup() {
    this.stopAutoSync()
    this.userId = null
    console.log('CloudSyncService: Cleaned up')
  }
}

// Export singleton instance
export const cloudSyncService = new CloudSyncService()
export type { UserPreferences }
