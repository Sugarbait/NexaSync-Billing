'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { cloudSyncService, UserPreferences } from '@/lib/services/cloudSyncService'

interface CloudSyncContextType {
  preferences: UserPreferences | null
  syncStatus: { enabled: boolean; lastSync?: string; deviceId: string }
  isSyncing: boolean
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>
  forceSync: () => Promise<void>
}

const CloudSyncContext = createContext<CloudSyncContextType | undefined>(undefined)

export function CloudSyncProvider({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [syncStatus, setSyncStatus] = useState(cloudSyncService.getSyncStatus())
  const [isSyncing, setIsSyncing] = useState(false)

  // Initialize sync service when user ID is available
  useEffect(() => {
    if (userId) {
      cloudSyncService.setUserId(userId)

      // Load cached preferences immediately
      const cached = cloudSyncService.getCachedPreferences()
      if (cached) {
        setPreferences(cached)
      }

      // Sync from cloud
      syncFromCloud()

      // Update sync status
      setSyncStatus(cloudSyncService.getSyncStatus())
    }

    return () => {
      if (!userId) {
        cloudSyncService.cleanup()
      }
    }
  }, [userId])

  // Listen for cloud preferences updates (from other devices)
  useEffect(() => {
    const handleCloudUpdate = (event: CustomEvent) => {
      console.log('CloudSyncProvider: Preferences updated from cloud', event.detail)
      setPreferences(event.detail as UserPreferences)
      setSyncStatus(cloudSyncService.getSyncStatus())
    }

    window.addEventListener('cloudPreferencesUpdated', handleCloudUpdate as EventListener)

    return () => {
      window.removeEventListener('cloudPreferencesUpdated', handleCloudUpdate as EventListener)
    }
  }, [])

  const syncFromCloud = useCallback(async () => {
    if (!userId) return

    setIsSyncing(true)
    try {
      const result = await cloudSyncService.syncFromCloud()
      if (result.success && result.preferences) {
        setPreferences(result.preferences)
        setSyncStatus(cloudSyncService.getSyncStatus())
      }
    } catch (error) {
      // Silently handle errors - the service already logs them
      console.debug('CloudSyncProvider: Sync completed with fallback')
    } finally {
      setIsSyncing(false)
    }
  }, [userId])

  const updatePreferences = useCallback(async (newPrefs: Partial<UserPreferences>) => {
    if (!userId) return

    const updated = { ...preferences, ...newPrefs }
    setPreferences(updated)

    // Sync to cloud in background
    setIsSyncing(true)
    try {
      await cloudSyncService.syncToCloud(updated)
      setSyncStatus(cloudSyncService.getSyncStatus())
    } catch (error) {
      // Silently handle errors - the service already logs them
      console.debug('CloudSyncProvider: Update completed with fallback')
    } finally {
      setIsSyncing(false)
    }
  }, [preferences, userId])

  const forceSync = useCallback(async () => {
    if (!userId) return

    setIsSyncing(true)
    try {
      await cloudSyncService.forceSyncNow()
      await syncFromCloud()
    } catch (error) {
      // Silently handle errors - the service already logs them
      console.debug('CloudSyncProvider: Force sync completed with fallback')
    } finally {
      setIsSyncing(false)
    }
  }, [userId, syncFromCloud])

  const value: CloudSyncContextType = {
    preferences,
    syncStatus,
    isSyncing,
    updatePreferences,
    forceSync
  }

  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  )
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext)
  if (context === undefined) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider')
  }
  return context
}
