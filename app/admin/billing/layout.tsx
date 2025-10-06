/**
 * ⚠️ SECURITY CRITICAL FILE - DO NOT MODIFY WITHOUT AUTHORIZATION ⚠️
 *
 * This file enforces authentication and MFA verification for all billing routes.
 * Any unauthorized changes could compromise system security.
 *
 * Protected Features:
 * - Route-level MFA verification (lines 64-74)
 * - Session clearing on logout (lines 86-89)
 * - User isolation enforcement
 *
 * Contact: elitesquadp@protonmail.com for authorization
 */

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Users, FileText, Settings, Shield, LayoutDashboard, UserCircle, LogOut, ChevronDown, Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { BillingUser } from '@/lib/types/auth'
import { NewsTicker } from '@/components/ui/NewsTicker'
import { NotificationProvider } from '@/components/ui/Notification'
import { CloudSyncProvider } from '@/components/providers/CloudSyncProvider'

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<BillingUser | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  async function loadCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: billingUser } = await supabase
        .from('billing_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (billingUser) {
        setCurrentUser(billingUser)

        // MFA verification check
        if (billingUser.mfa_enabled) {
          const mfaVerified = sessionStorage.getItem('mfa_verified')
          if (mfaVerified !== 'true') {
            // MFA is required but not verified in this session
            await supabase.auth.signOut()
            sessionStorage.clear()
            router.push('/login')
            return
          }
        }
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Failed to load user:', error)
      router.push('/login')
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      sessionStorage.clear()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const navItems = [
    { href: '/admin/billing', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/billing/customers', label: 'Customers', icon: Users },
    { href: '/admin/billing/invoices', label: 'Invoices', icon: FileText },
    { href: '/admin/billing/settings', label: 'Settings', icon: Settings },
  ]

  // Add Users nav item only for super admins
  if (currentUser?.role === 'super_admin') {
    navItems.splice(3, 0, { href: '/admin/billing/users', label: 'Users', icon: UserCircle })
  }

  return (
    <NotificationProvider>
      <CloudSyncProvider userId={currentUser?.id}>
        <div className="min-h-screen bg-gray-200 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-2 md:gap-8">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
            >
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="flex items-center space-x-3 shrink-0">
              <Link href="/admin/billing">
                <Image
                  src="https://nexasync.ca/images/NexaSync-White.png"
                  alt="NexaSync Logo"
                  width={220}
                  height={60}
                  className="h-8 md:h-12 w-auto"
                  priority
                />
              </Link>
            </div>

            {/* AI News Ticker - Hidden on mobile */}
            <div className="hidden md:flex flex-1 min-w-0">
              <NewsTicker />
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
              {/* Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {currentUser?.full_name || 'Loading...'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {currentUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {currentUser?.full_name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {currentUser?.email}
                      </p>
                      {currentUser?.mfa_enabled && (
                        <div className="flex items-center gap-1 mt-2">
                          <Shield className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-green-600 dark:text-green-400">MFA Enabled</span>
                        </div>
                      )}
                    </div>

                    <Link
                      href="/admin/billing/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UserCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">My Profile</span>
                    </Link>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm text-red-600 dark:text-red-400">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
        )}

        {/* Sidebar - Desktop and Mobile Drawer */}
        <aside className={`
          ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:static
          inset-y-0 left-0
          w-64
          bg-gray-100 dark:bg-gray-800
          border-r border-gray-300 dark:border-gray-700
          min-h-[calc(100vh-73px)] lg:min-h-[calc(100vh-73px)]
          transition-transform duration-300 ease-in-out
          z-50 lg:z-0
          overflow-y-auto
        `}>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin/billing' && pathname?.startsWith(item.href))
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 mt-8">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">Security Notice</p>
              <p className="text-xs text-blue-800 dark:text-blue-400">
                This platform handles billing data only. No PHI or HIPAA protected information is stored or processed.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full lg:w-auto">
          {children}
        </main>
      </div>
    </div>
      </CloudSyncProvider>
    </NotificationProvider>
  )
}
