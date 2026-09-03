'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '@/types/roles'
import { ROLE_HOME } from '@/types/roles'
import { authenticateUser, getUserById, type User as DbUser } from './auth-db'

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
   * Login with email and password
   * Returns error message if login fails
   */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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
    
    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setSessionCookie(parsed.id, parsed.role)
        setUser(parsed)
      } catch {
        localStorage.removeItem('hl_token')
        localStorage.removeItem('hl_user')
      }
    } else {
      // Fall back to cookie-based mock session
      const { userId } = getSessionCookies()
      if (userId) {
        const dbUser = getUserById(userId)
        if (dbUser) {
          setUser(dbUserToUser(dbUser))
        } else {
          setSessionCookie(null, null)
        }
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }> => {
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
            // Dev test accounts fall through to mock login
            if (email.includes('test.com')) {
              console.log('Dev test account - falling back to mock login')
            } else if (data.requiresVerification) {
              return { success: false, error: data.message, requiresVerification: true, email: data.email }
            } else {
              return { success: false, error: data.message || 'Login failed' }
            }
          } else {
            // Store JWT token
            localStorage.setItem('hl_token', data.token)
            
            // Map API response to User format
            const apiUser: User = {
              id: data.user.id,
              name: `${data.user.firstName} ${data.user.lastName}`,
              email: data.user.email,
              role: data.user.role as Role,
              verificationStatus: data.user.emailVerified ? 'verified' : 'pending'
            }
            
            // Store user for session persistence
            localStorage.setItem('hl_user', JSON.stringify(apiUser))
            setSessionCookie(data.user.id, apiUser.role)
            setUser(apiUser)
            router.push(ROLE_HOME[apiUser.role])
            return { success: true }
          }
        } catch (error) {
          console.error('Real API login failed, falling back to mock:', error)
          // Fall through to mock login
        }
      }
      
      // Mock login (MOCK_MODE or API failed)
      const result = authenticateUser(email, password)
      
      if (result.success && result.user) {
        const userObj = dbUserToUser(result.user)
        setUser(userObj)
        setSessionCookie(result.user.id, result.user.role)
        router.push(ROLE_HOME[result.user.role])
        return { success: true }
      }

      return { success: false, error: result.error }
    }, [router])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('hl_token')
    localStorage.removeItem('hl_user')
    document.cookie = 'session_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/')
  }, [router])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
