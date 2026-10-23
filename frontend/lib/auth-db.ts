/**
 * Simple in-memory database for authentication
 * In production, replace this with a real database (PostgreSQL, MongoDB, etc.)
 */

export interface User {
  id: string
  email: string
  password: string // In production, this would be hashed with bcrypt
  fullName: string
  phone: string
  role: 'tenant' | 'landlord' | 'admin'
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
  verificationToken?: string
  resetToken?: string
  resetTokenExpiry?: number
  createdAt: string
  // Landlord verification fields
  verificationDocuments?: {
    identityDocument?: string // Base64 or file path
    propertyDocument?: string // Base64 or file path
    submittedAt?: string
  }
  rejectionReason?: string // Present when status is 'rejected'
  verifiedAt?: string
  verifiedBy?: string // Admin user ID who verified
}

// In-memory users database (simulates a real database)
const users: Map<string, User> = new Map()

// Helper to generate unique IDs
function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper to generate tokens
function generateToken(): string {
  return Math.random().toString(36).substr(2) + Date.now().toString(36)
}

/**
 * Create a new user account
 */
export function createUser(data: {
  email: string
  password: string
  fullName: string
  phone: string
  role: 'tenant' | 'landlord' | 'admin'
}): { success: boolean; user?: User; error?: string } {
  // Check if email already exists
  const existingUser = Array.from(users.values()).find(
    (u) => u.email.toLowerCase() === data.email.toLowerCase()
  )

  if (existingUser) {
    return { success: false, error: 'Email already registered' }
  }

  // **DEVELOPMENT MODE: Auto-verify users** 
  // In production, set verificationStatus to 'pending' and send verification email
  const isDevelopment = process.env.NODE_ENV === 'development' || typeof window !== 'undefined'

  // Create new user
  const user: User = {
    id: generateId(),
    email: data.email,
    password: data.password, // In production, hash this with bcrypt
    fullName: data.fullName,
    phone: data.phone,
    role: data.role,
    verificationStatus: isDevelopment ? 'verified' : 'pending', // ← Auto-verify in dev mode
    verificationToken: isDevelopment ? undefined : generateToken(),
    createdAt: new Date().toISOString(),
  }

  users.set(user.id, user)

  console.log(`✅ User created: ${user.email} (${user.role}) - Status: ${user.verificationStatus}`)

  return { success: true, user }
}

/**
 * Authenticate user with email and password
 */
export function authenticateUser(
  email: string,
  password: string
): { success: boolean; user?: User; error?: string } {
  const user = Array.from(users.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  )

  if (!user) {
    return { success: false, error: 'Invalid email or password' }
  }

  // In production, use bcrypt.compare(password, user.password)
  if (user.password !== password) {
    return { success: false, error: 'Invalid email or password' }
  }

  // Check if email is verified
  if (user.verificationStatus !== 'verified') {
    return { success: false, error: 'Please verify your email before logging in' }
  }

  return { success: true, user }
}

/**
 * Verify email with token
 */
export function verifyEmail(token: string): { success: boolean; error?: string } {
  const user = Array.from(users.values()).find((u) => u.verificationToken === token)

  if (!user) {
    return { success: false, error: 'Invalid or expired verification token' }
  }

  user.verificationStatus = 'verified'
  user.verificationToken = undefined

  return { success: true }
}

/**
 * Request password reset
 */
export function requestPasswordReset(email: string): { success: boolean; token?: string; error?: string } {
  const user = Array.from(users.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  )

  if (!user) {
    // Don't reveal if email exists or not (security best practice)
    return { success: true, token: 'dummy_token' }
  }

  const token = generateToken()
  user.resetToken = token
  user.resetTokenExpiry = Date.now() + 60 * 60 * 1000 // 1 hour from now

  return { success: true, token }
}

/**
 * Reset password with token
 */
export function resetPassword(
  token: string,
  newPassword: string
): { success: boolean; error?: string } {
  const user = Array.from(users.values()).find((u) => u.resetToken === token)

  if (!user) {
    return { success: false, error: 'Invalid or expired reset token' }
  }

  if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
    return { success: false, error: 'Reset token has expired' }
  }

  // In production, hash the password with bcrypt
  user.password = newPassword
  user.resetToken = undefined
  user.resetTokenExpiry = undefined

  return { success: true }
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | undefined {
  return users.get(id)
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | undefined {
  return Array.from(users.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  )
}

/**
 * Initialize with some demo users for testing
 */
export function initializeDemoUsers() {
  // Clear existing users
  users.clear()

  // Create demo users (already verified)
  const demoUsers: Omit<User, 'id' | 'createdAt'>[] = [
    {
      email: 'tenant@test.com',
      password: 'password123',
      fullName: 'Tsedi Tesfaye',
      phone: '+251 911 123456',
      role: 'tenant',
      verificationStatus: 'verified',
    },
    {
      email: 'landlord@test.com',
      password: 'password123',
      fullName: 'Abebe Tekle',
      phone: '+251 911 234567',
      role: 'landlord',
      verificationStatus: 'verified',
    },
    {
      email: 'admin@test.com',
      password: 'password123',
      fullName: 'Selam Haile',
      phone: '+251 911 345678',
      role: 'admin',
      verificationStatus: 'verified',
    },
  ]

  demoUsers.forEach((userData) => {
    const user: User = {
      ...userData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    users.set(user.id, user)
  })
}

// Initialize demo users on module load
initializeDemoUsers()

/**
 * Get all users (for debugging)
 */
export function getAllUsers(): User[] {
  return Array.from(users.values())
}
