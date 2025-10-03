/**
 * Format a number as CAD currency
 */
export function formatCAD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Format a date
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid Date'
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d)
}

/**
 * Format a date range
 */
export function formatDateRange(range: { start: Date | string; end: Date | string }): string {
  return `${formatDate(range.start)} - ${formatDate(range.end)}`
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Get date suffix (1st, 2nd, 3rd, etc.)
 */
export function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'

  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

/**
 * Get previous month date range
 */
export function getPreviousMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start, end }
}

/**
 * Get current month date range
 */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date()
  return { start, end }
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvRows = []

  // Add header row
  csvRows.push(headers.join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      // Escape quotes and wrap in quotes if contains comma
      const escaped = String(value).replace(/"/g, '""')
      return escaped.includes(',') ? `"${escaped}"` : escaped
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

/**
 * Download a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}

/**
 * Calculate trend percentage
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}
