'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

// Utility function to format date for HTML input
const formatDateForInput = (date: Date) => {
  return date.toISOString().split('T')[0]
}

export type DateRange = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

interface DateRangePickerProps {
  selectedRange: DateRange
  onRangeChange: (range: DateRange, customStart?: Date, customEnd?: Date) => void
  className?: string
  customStartDate?: Date
  customEndDate?: Date
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  selectedRange,
  onRangeChange,
  className = '',
  customStartDate: propCustomStartDate,
  customEndDate: propCustomEndDate
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState(() =>
    propCustomStartDate ? formatDateForInput(propCustomStartDate) : ''
  )
  const [customEndDate, setCustomEndDate] = useState(() =>
    propCustomEndDate ? formatDateForInput(propCustomEndDate) : ''
  )
  const [showCustomInputs, setShowCustomInputs] = useState(false)

  // Sync internal state with prop changes
  useEffect(() => {
    if (propCustomStartDate) {
      setCustomStartDate(formatDateForInput(propCustomStartDate))
    }
    if (propCustomEndDate) {
      setCustomEndDate(formatDateForInput(propCustomEndDate))
    }
  }, [propCustomStartDate, propCustomEndDate])

  const dateRangeOptions = [
    { value: 'today' as DateRange, label: 'Today' },
    { value: 'yesterday' as DateRange, label: 'Yesterday' },
    { value: 'thisWeek' as DateRange, label: 'This Week' },
    { value: 'lastWeek' as DateRange, label: 'Last Week' },
    { value: 'thisMonth' as DateRange, label: 'This Month' },
    { value: 'lastMonth' as DateRange, label: 'Last Month' },
    { value: 'thisYear' as DateRange, label: 'This Year' },
    { value: 'custom' as DateRange, label: 'Custom Range' }
  ]

  const getSelectedLabel = () => {
    const option = dateRangeOptions.find(opt => opt.value === selectedRange)
    if (selectedRange === 'custom' && propCustomStartDate && propCustomEndDate) {
      const startFormatted = propCustomStartDate.toLocaleDateString()
      const endFormatted = propCustomEndDate.toLocaleDateString()
      return `${startFormatted} - ${endFormatted}`
    }
    return option?.label || 'Select Range'
  }

  const handleRangeSelect = (range: DateRange) => {
    if (range === 'custom') {
      setShowCustomInputs(true)
    } else {
      setShowCustomInputs(false)
      onRangeChange(range)
      setIsOpen(false)
    }
  }

  const handleCustomApply = () => {
    if (customStartDate && customEndDate) {
      // Fix timezone issue by parsing as local date
      const startDate = new Date(customStartDate + 'T00:00:00')
      const endDate = new Date(customEndDate + 'T00:00:00')
      onRangeChange('custom', startDate, endDate)
      setIsOpen(false)
      setShowCustomInputs(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        aria-label="Select date range"
      >
        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm">{getSelectedLabel()}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-healthcare-lg z-50">
          <div className="p-2">
            {!showCustomInputs ? (
              <div className="space-y-1">
                {dateRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleRangeSelect(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                      selectedRange === option.value
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                    aria-label={`Select ${option.label} date range`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Custom Date Range</h3>
                  <button
                    onClick={() => {
                      setShowCustomInputs(false)
                      setIsOpen(false)
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                    aria-label="Close custom date picker"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowCustomInputs(false)
                      setCustomStartDate('')
                      setCustomEndDate('')
                    }}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomApply}
                    disabled={!customStartDate || !customEndDate}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false)
            setShowCustomInputs(false)
          }}
        />
      )}
    </div>
  )
}

// Utility functions to get date ranges
export const getDateRangeFromSelection = (range: DateRange, customStart?: Date, customEnd?: Date) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      }

    case 'yesterday':
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)
      const endOfYesterday = new Date(yesterday)
      endOfYesterday.setHours(23, 59, 59, 999)
      return { start: yesterday, end: endOfYesterday }

    case 'thisWeek':
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      return { start: startOfWeek, end: endOfWeek }

    case 'lastWeek':
      const startOfLastWeek = new Date(today)
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7)
      startOfLastWeek.setHours(0, 0, 0, 0)
      const endOfLastWeek = new Date(startOfLastWeek)
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6)
      endOfLastWeek.setHours(23, 59, 59, 999)
      return { start: startOfLastWeek, end: endOfLastWeek }

    case 'thisMonth':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      endOfMonth.setHours(23, 59, 59, 999)
      return { start: startOfMonth, end: endOfMonth }

    case 'lastMonth':
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      endOfLastMonth.setHours(23, 59, 59, 999)
      return { start: startOfLastMonth, end: endOfLastMonth }

    case 'thisYear':
      const startOfYear = new Date(today.getFullYear(), 0, 1)
      const endOfYear = new Date(today.getFullYear(), 11, 31)
      endOfYear.setHours(23, 59, 59, 999)
      return { start: startOfYear, end: endOfYear }

    case 'custom':
      if (customStart && customEnd) {
        // Fix timezone issue by ensuring dates are treated as local dates
        const start = new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate())
        const end = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate())
        end.setHours(23, 59, 59, 999)
        return { start, end }
      }
      return { start: today, end: today }

    default:
      return { start: today, end: today }
  }
}
