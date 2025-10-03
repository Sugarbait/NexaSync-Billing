'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Mark component as mounted
    setMounted(true)

    // Sync state with current theme (already applied by script in layout.tsx)
    const currentTheme = localStorage.getItem('theme')
    const isDarkMode = currentTheme === 'dark'
    setIsDark(isDarkMode)

    // Ensure DOM is in sync with localStorage
    const htmlElement = document.documentElement
    if (isDarkMode) {
      htmlElement.classList.add('dark')
      htmlElement.style.colorScheme = 'dark'
    } else {
      htmlElement.classList.remove('dark')
      htmlElement.style.colorScheme = 'light'
    }

    console.log('Theme initialized:', isDarkMode ? 'dark' : 'light', 'localStorage:', currentTheme)
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    const htmlElement = document.documentElement
    const newTheme = newIsDark ? 'dark' : 'light'

    // Update localStorage first
    localStorage.setItem('theme', newTheme)

    // Update DOM
    if (newIsDark) {
      htmlElement.classList.add('dark')
      htmlElement.style.colorScheme = 'dark'
      console.log('Switched to DARK mode')
    } else {
      htmlElement.classList.remove('dark')
      htmlElement.style.colorScheme = 'light'
      console.log('Switched to LIGHT mode')
    }

    // Update React state
    setIsDark(newIsDark)

    // Force style recalculation and repaint
    void htmlElement.offsetHeight
    htmlElement.setAttribute('data-theme', newTheme)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="p-2 w-9 h-9" aria-hidden="true">
        {/* Placeholder to prevent layout shift */}
      </div>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      ) : (
        <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      )}
    </button>
  )
}
