import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  color?: 'gray' | 'blue' | 'green' | 'red' | 'yellow'
  className?: string
}

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  const colors = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800'
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}
    >
      {children}
    </span>
  )
}
