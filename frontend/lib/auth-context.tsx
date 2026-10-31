'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '@/types/roles'
import { ROLE_HOME } from '@/types/roles'
import { authenticateUser, getUserById, type User as DbUser } from './auth-db'
import { useFavoritesStore } from './store'

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE !== 'false'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  verificationStatus: VerificationStatus
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  /**
   * Login with email and password, with optional redirect URL
   * Returns error message if login fails
   */
  login: (email: string, password: string, redirectTo?: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string; user?: User }>
  logout: (redirectTo?: string) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function clearAllAuthSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('hl_token')
  localStorage.removeItem('hl_user')
  localStorage.removeItem('hl_favorites')
  try {
    useFavoritesStore.getState().resetFavorites()
  } catch { /* ignore */ }
  document.cookie = 'session_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = 'session_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

function setSessionCookie(userId: string | null, role: Role | null) {
  if (typeof document === 'undefined') return
  if (userId && role) {
    // 8-hour session
    document.cookie = `session_user_id=${userId}; path=/; max-age=${60 * 60 * 8}`
    document.cookie = `session_role=${role}; path=/; max-age=${60 * 60 * 8}`
  } else {
    document.cookie = 'session_user_id=; path=/; max-age=0'
    document.cookie = 'session_role=; path=/; max-age=0'
  }
}

function getSessionCookies(): { userId: string | null; role: Role | null } {
  if (typeof document === 'undefined') return { userId: null, role: null }
  
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)

  return {
    userId: cookies.session_user_id || null,
    role: (cookies.session_role as Role) || null,
  }
}

function dbUserToUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    name: dbUser.fullName,
    email: dbUser.email,
    role: dbUser.role,
    verificationStatus: dbUser.verificationStatus,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user from session on mount
  useEffect(() => {
    // Try JWT token first (real API mode)
    const token = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('hl_user') : null
    
    if (token) {
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser)
          setSessionCookie(parsed.id, parsed.role)
          setUser(parsed)
        } catch {
          localStorage.removeItem('hl_token')
          localStorage.removeItem('hl_user')
        }
      }
      // Synchronize latest verified identity status from backend
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(res => {
          if (res?.user) {
            const freshUser: User = {
              id: res.user.id || res.user._id,
              name: `${res.user.firstName || ''} ${res.user.lastName || ''}`.trim() || res.user.name || 'User',
              email: res.user.email,
              role: res.user.role as Role,
              verificationStatus: (res.user.verificationStatus || res.user.identityStatus || (res.user.role === 'admin' ? 'verified' : 'unverified')) as VerificationStatus
            }
            localStorage.setItem('hl_user', JSON.stringify(freshUser))
            setSessionCookie(freshUser.id, freshUser.role)
            setUser(freshUser)
          }
        })
        .catch(() => {})
    } else {
      // Fall back to cookie-based mock session
      const { userId } = getSessionCookies()
      if (userId) {
        const dbUser = getUserById(userId)
        if (dbUser) {
          const userObj = dbUserToUser(dbUser)
          setUser(userObj)
          if (typeof window !== 'undefined' && !localStorage.getItem('hl_token')) {
            localStorage.setItem('hl_token', `dev_mock_jwt_token_${userObj.role}`)
            localStorage.setItem('hl_user', JSON.stringify(userObj))
          }
        } else {
          setSessionCookie(null, null)
        }
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(
    async (email: string, password: string, redirectTo?: string): Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string; user?: User }> => {
      // Try real API first if not in mock mode
      if (!MOCK_MODE) {
        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })
          
          const data = await response.json()
          
          if (!response.ok) {
            if (data.requiresVerification) {
              return { success: false, error: data.message, requiresVerification: true, email: data.email }
            } else {
              return { success: false, error: data.message || 'Login failed' }
            }
          } else {
            // Store JWT token
            localStorage.setItem('hl_token', data.token)
            
            // Map API response to User format
            const apiUser: User = {
              id: data.user.id || data.user._id,
              name: `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || data.user.name || 'User',
              email: data.user.email,
              role: data.user.role as Role,
              verificationStatus: (data.user.verificationStatus || data.user.identityStatus || (data.user.role === 'admin' ? 'verified' : 'unverified')) as VerificationStatus
            }
            
            // Store user for session persistence
            localStorage.setItem('hl_user', JSON.stringify(apiUser))
            setSessionCookie(apiUser.id, apiUser.role)
            setUser(apiUser)
            try {
              useFavoritesStore.getState().hydrate(apiUser.id)
            } catch { /* ignore */ }

            // Determine safe role destination
            let destination = ROLE_HOME[apiUser.role]
            if (redirectTo && !redirectTo.startsWith('/login') && !redirectTo.startsWith('/signup')) {
              const isCrossRole =
                (apiUser.role === 'landlord' && (redirectTo.startsWith('/tenant') || redirectTo.startsWith('/admin'))) ||
                (apiUser.role === 'tenant' && (redirectTo.startsWith('/landlord') || redirectTo.startsWith('/admin'))) ||
                (apiUser.role === 'admin' && (redirectTo.startsWith('/tenant') || redirectTo.startsWith('/landlord')))
              if (!isCrossRole) {
                destination = redirectTo
              }
            }
            router.push(destination)
            return { success: true, user: apiUser }
          }
        } catch (error) {
          console.error('Real API login failed:', error)
          return { success: false, error: 'Cannot reach the server. Please try again in a moment.' }
        }
      }
      
      // Mock login (only when NEXT_PUBLIC_MOCK_MODE is explicitly not 'false')
      const result = authenticateUser(email, password)
      
      if (result.success && result.user) {
        const userObj = dbUserToUser(result.user)
        setUser(userObj)
        setSessionCookie(result.user.id, result.user.role)
        if (typeof window !== 'undefined') {
          localStorage.setItem('hl_token', `dev_mock_jwt_token_${result.user.role}`)
          localStorage.setItem('hl_user', JSON.stringify(userObj))
        }
        try {
          useFavoritesStore.getState().hydrate(result.user.id)
        } catch { /* ignore */ }

        let destination = ROLE_HOME[result.user.role]
        if (redirectTo && !redirectTo.startsWith('/login') && !redirectTo.startsWith('/signup')) {
          const isCrossRole =
            (result.user.role === 'landlord' && (redirectTo.startsWith('/tenant') || redirectTo.startsWith('/admin'))) ||
            (result.user.role === 'tenant' && (redirectTo.startsWith('/landlord') || redirectTo.startsWith('/admin'))) ||
            (result.user.role === 'admin' && (redirectTo.startsWith('/tenant') || redirectTo.startsWith('/landlord')))
          if (!isCrossRole) {
            destination = redirectTo
          }
        }
        router.push(destination)
        return { success: true, user: userObj }
      }

      return { success: false, error: result.error }
    }, [router])

  const logout = useCallback((redirectTo?: string) => {
    setUser(null)
    clearAllAuthSession()
    if (redirectTo) {
      router.push(redirectTo)
    } else {
      router.push('/')
    }
  }, [router])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
