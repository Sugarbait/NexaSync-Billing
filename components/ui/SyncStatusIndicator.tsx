'use client'

import React from 'react'
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react'
import { useCloudSync } from '@/components/providers/CloudSyncProvider'

export function SyncStatusIndicator() {
  const { syncStatus, isSyncing, forceSync } = useCloudSync()

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never'

    const date = new Date(lastSync)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const handleClick = async () => {
    if (!isSyncing) {
      await forceSync()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSyncing}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Last synced: ${formatLastSync(syncStatus.lastSync)}${isSyncing ? ' - Syncing...' : ' - Click to sync now'}`}
    >
      {isSyncing ? (
        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
      ) : syncStatus.enabled && syncStatus.lastSync ? (
        <div className="relative">
          <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
          <Check className="w-2 h-2 text-green-600 dark:text-green-400 absolute -bottom-0.5 -right-0.5" />
        </div>
      ) : syncStatus.enabled ? (
        <Cloud className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      ) : (
        <CloudOff className="w-4 h-4 text-gray-400 dark:text-gray-500" />
      )}
      <span className="hidden sm:inline text-xs text-gray-600 dark:text-gray-400">
        {isSyncing ? 'Syncing...' : formatLastSync(syncStatus.lastSync)}
      </span>
    </button>
  )
}
