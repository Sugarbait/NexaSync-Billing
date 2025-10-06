'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

interface NotificationContextType {
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  showConfirm: (message: string, onConfirm: () => void) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

interface ConfirmDialog {
  message: string
  onConfirm: () => void
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, message, type }])

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }, [])

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm })
  }, [])

  const handleConfirm = () => {
    if (confirmDialog) {
      confirmDialog.onConfirm()
      setConfirmDialog(null)
    }
  }

  const handleCancel = () => {
    setConfirmDialog(null)
  }

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <NotificationContext.Provider value={{ showNotification, showConfirm }}>
      {children}

      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`
              min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border
              flex items-start gap-3
              animate-in slide-in-from-right duration-300
              ${notification.type === 'success' ? 'bg-green-50 dark:bg-green-900/60 border-green-200 dark:border-green-700' : ''}
              ${notification.type === 'error' ? 'bg-red-50 dark:bg-red-900/60 border-red-200 dark:border-red-700' : ''}
              ${notification.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/60 border-yellow-200 dark:border-yellow-700' : ''}
              ${notification.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/60 border-blue-200 dark:border-blue-700' : ''}
            `}
          >
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />}
            {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />}
            {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}

            <p className={`
              flex-1 text-sm
              ${notification.type === 'success' ? 'text-green-800 dark:text-green-200' : ''}
              ${notification.type === 'error' ? 'text-red-800 dark:text-red-200' : ''}
              ${notification.type === 'warning' ? 'text-yellow-800 dark:text-yellow-200' : ''}
              ${notification.type === 'info' ? 'text-blue-800 dark:text-blue-200' : ''}
            `}>
              {notification.message}
            </p>

            <button
              onClick={() => removeNotification(notification.id)}
              className={`
                flex-shrink-0 rounded p-1 transition-colors
                ${notification.type === 'success' ? 'hover:bg-green-200 dark:hover:bg-green-800 text-green-600 dark:text-green-400' : ''}
                ${notification.type === 'error' ? 'hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400' : ''}
                ${notification.type === 'warning' ? 'hover:bg-yellow-200 dark:hover:bg-yellow-800 text-yellow-600 dark:text-yellow-400' : ''}
                ${notification.type === 'info' ? 'hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400' : ''}
              `}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Confirm Action</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}
