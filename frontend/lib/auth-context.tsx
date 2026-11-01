'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '@/types/roles'
import { ROLE_HOME } from '@/types/roles'
import { authenticateUser, getUserById, type User as DbUser } from './auth-db'
import { useFavoritesStore } from './store'

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'
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
              verificationStatus: (res.user.verificationStatus || res.user.identityStatus || (res.user.emailVerified ? 'verified' : 'pending')) as VerificationStatus
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
      // 1. Always attempt backend API first
      try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        
        const data = await response.json().catch(() => ({}))
        
        if (response.ok && data.token) {
          localStorage.setItem('hl_token', data.token)
          
          const apiUser: User = {
            id: data.user.id || data.user._id,
            name: `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || data.user.name || 'User',
            email: data.user.email,
            role: data.user.role as Role,
            verificationStatus: (data.user.verificationStatus || data.user.identityStatus || (data.user.emailVerified ? 'verified' : 'pending')) as VerificationStatus
          }
          
          localStorage.setItem('hl_user', JSON.stringify(apiUser))
          setSessionCookie(apiUser.id, apiUser.role)
          setUser(apiUser)
          try {
            useFavoritesStore.getState().hydrate(apiUser.id)
          } catch { /* ignore */ }
          if (redirectTo) {
            router.push(redirectTo)
          } else {
            router.push(ROLE_HOME[apiUser.role])
          }
          return { success: true, user: apiUser }
        } else if (response.status === 401 || response.status === 400) {
          if (data.requiresVerification) {
            return { success: false, error: data.message, requiresVerification: true, email: data.email }
          }
          // If real backend explicitly rejected credentials, check local dev store as fallback
          const mockCheck = authenticateUser(email, password)
          if (mockCheck.success && mockCheck.user) {
            const userObj = dbUserToUser(mockCheck.user)
            setUser(userObj)
            setSessionCookie(mockCheck.user.id, mockCheck.user.role)
            if (typeof window !== 'undefined') {
              localStorage.setItem('hl_token', `dev_mock_jwt_token_${mockCheck.user.role}`)
              localStorage.setItem('hl_user', JSON.stringify(userObj))
            }
            if (redirectTo) router.push(redirectTo)
            else router.push(ROLE_HOME[mockCheck.user.role])
            return { success: true, user: userObj }
          }
          return { success: false, error: data.message || 'Invalid email or password' }
        }
      } catch (error) {
        console.warn('Backend login network error, falling back to local store:', error)
      }
      
      // 2. Local fallback if backend network is unreachable
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
        if (redirectTo) {
          router.push(redirectTo)
        } else {
          router.push(ROLE_HOME[result.user.role])
        }
        return { success: true, user: userObj }
      }

      return { success: false, error: result.error || 'Invalid email or password' }
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
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
