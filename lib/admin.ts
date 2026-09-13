/**
 * Admin utilities for landlord verification management
 *
 * This file contains:
 * 1. Mock data constants used by admin dashboard components
 * 2. Utility functions for landlord verification management
 */

import { User, getUserByEmail, getAllUsers } from './auth-db'
import { personPhoto } from './images'

// ---------------------------------------------------------------------------
// Types exported for use in admin components
// ---------------------------------------------------------------------------

export interface PendingVerification {
  userId: string
  landlordName: string
  email: string
  submittedAt: string
  documents: {
    identityDocument?: string
    propertyDocument?: string
  }
}

/**
 * Get all pending landlord verifications
 * @returns Array of pending verification requests
 */
export function getAllPendingVerifications(): PendingVerification[] {
  const allUsers = getAllUsers()
  
  const pendingLandlords = allUsers.filter(
    (user) => user.role === 'landlord' && user.verificationStatus === 'pending'
  )

  return pendingLandlords.map((user) => ({
    userId: user.id,
    landlordName: user.fullName,
    email: user.email,
    submittedAt: user.verificationDocuments?.submittedAt || user.createdAt,
    documents: {
      identityDocument: user.verificationDocuments?.identityDocument,
      propertyDocument: user.verificationDocuments?.propertyDocument,
    },
  }))
}

/**
 * Approve a landlord verification
 * @param userId User ID of the landlord to approve
 * @param adminId Admin user ID who is approving
 * @returns Success status
 */
export function approveVerification(
  userId: string,
  adminId?: string
): { success: boolean; error?: string } {
  const allUsers = getAllUsers()
  const user = allUsers.find((u) => u.id === userId)

  if (!user) {
    return { success: false, error: 'User not found' }
  }

  if (user.role !== 'landlord') {
    return { success: false, error: 'User is not a landlord' }
  }

  // Update verification status
  user.verificationStatus = 'verified'
  user.verifiedAt = new Date().toISOString()
  if (adminId) {
    user.verifiedBy = adminId
  }
  user.rejectionReason = undefined // Clear any previous rejection reason

  console.log(`✅ Landlord verified: ${user.email}`)

  return { success: true }
}

/**
 * Reject a landlord verification with reason
 * @param userId User ID of the landlord to reject
 * @param reason Rejection reason
 * @returns Success status
 */
export function rejectVerification(
  userId: string,
  reason: string
): { success: boolean; error?: string } {
  const allUsers = getAllUsers()
  const user = allUsers.find((u) => u.id === userId)

  if (!user) {
    return { success: false, error: 'User not found' }
  }

  if (user.role !== 'landlord') {
    return { success: false, error: 'User is not a landlord' }
  }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'Rejection reason is required' }
  }

  // Update verification status
  user.verificationStatus = 'rejected'
  user.rejectionReason = reason
  user.verifiedAt = undefined
  user.verifiedBy = undefined

  console.log(`❌ Landlord rejected: ${user.email} - Reason: ${reason}`)

  return { success: true }
}

/**
 * Submit verification documents for a landlord
 * @param userId User ID of the landlord
 * @param documents Document data (base64 or file paths)
 * @returns Success status
 */
export function submitVerificationDocuments(
  userId: string,
  documents: {
    identityDocument?: string
    propertyDocument?: string
  }
): { success: boolean; error?: string } {
  const allUsers = getAllUsers()
  const user = allUsers.find((u) => u.id === userId)

  if (!user) {
    return { success: false, error: 'User not found' }
  }

  if (user.role !== 'landlord') {
    return { success: false, error: 'User is not a landlord' }
  }

  // Store documents and update status to pending
  user.verificationDocuments = {
    identityDocument: documents.identityDocument,
    propertyDocument: documents.propertyDocument,
    submittedAt: new Date().toISOString(),
  }
  user.verificationStatus = 'pending'

  console.log(`📄 Verification documents submitted: ${user.email}`)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Admin dashboard mock data
// ---------------------------------------------------------------------------

/** Admin user identity */
export const ADMIN_NAME = 'Admin User'
export const ADMIN_AVATAR = personPhoto('admin-homelink')

/** KPI card type */
export interface KpiStat {
  label: string
  value: string
  deltaLabel: string
  deltaDirection: 'up' | 'down'
}

/** KPI stats for Trust & Verification Center */
export const VERIFICATION_KPIS: KpiStat[] = [
  { label: 'In Verification', value: '24', deltaLabel: '+12% this week', deltaDirection: 'up' },
  { label: 'Fraud Reports', value: '7', deltaLabel: '-3% this week', deltaDirection: 'down' },
  { label: 'Active Disputes', value: '5', deltaLabel: '+2 this week', deltaDirection: 'up' },
  { label: 'Verification Rate', value: '87%', deltaLabel: '+4% vs last month', deltaDirection: 'up' },
]

/** Verification queue item */
export interface QueueItem {
  id: string
  title: string
  subtitle: string
  avatar: string
  risk: 'high' | 'medium' | 'low'
  timeAgo: string
  type: string
}

/** Verification queue sorted high → medium → low */
export const VERIFICATION_QUEUE: QueueItem[] = [
  { id: 'VQ-041', title: 'Abebe Kebede', subtitle: 'Bole, 2-bed apt', avatar: personPhoto('abebe-kebede'), risk: 'high', timeAgo: '2h ago', type: 'Landlord' },
  { id: 'VQ-039', title: 'Fatuma Hassan', subtitle: 'Kazanchis, studio', avatar: personPhoto('fatuma-hassan'), risk: 'high', timeAgo: '5h ago', type: 'Landlord' },
  { id: 'VQ-037', title: 'Dawit Tesfaye', subtitle: 'CMC, 3-bed house', avatar: personPhoto('dawit-tesfaye'), risk: 'medium', timeAgo: '1d ago', type: 'Property' },
  { id: 'VQ-035', title: 'Hana Mekonnen', subtitle: 'Megenagna, 1-bed apt', avatar: personPhoto('hana-mekonnen'), risk: 'medium', timeAgo: '1d ago', type: 'Landlord' },
  { id: 'VQ-032', title: 'Yonas Bekele', subtitle: 'Old Airport, villa', avatar: personPhoto('yonas-bekele'), risk: 'low', timeAgo: '2d ago', type: 'Property' },
  { id: 'VQ-028', title: 'Sara Girma', subtitle: 'Sarbet, 2-bed apt', avatar: personPhoto('sara-girma'), risk: 'low', timeAgo: '3d ago', type: 'Landlord' },
]

/** Risk badge Tailwind classes by risk level */
export const RISK_BADGE_CLASS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
}

/** Human-readable risk labels */
export const RISK_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Low Risk',
}

/** Verification progress summary */
export const VERIFICATION_PROGRESS = { total: 156 }

/** Verification progress chart data (Recharts-compatible) */
export const VERIFICATION_PROGRESS_CHART = [
  { name: 'Verified', value: 118, color: '#16a34a' },
  { name: 'Pending', value: 24, color: '#f59e0b' },
  { name: 'Rejected', value: 14, color: '#dc2626' },
]

/** Risk level distribution chart data (Recharts-compatible) */
export const RISK_LEVEL_DISTRIBUTION = [
  { name: 'High', pct: 18, color: '#dc2626' },
  { name: 'Medium', pct: 35, color: '#f59e0b' },
  { name: 'Low', pct: 47, color: '#16a34a' },
]

/** Fraud reports grouped by type (for animated bar chart) */
export const FRAUD_REPORTS_BY_TYPE = [
  { type: 'Fake Listing', count: 12 },
  { type: 'Payment Scam', count: 8 },
  { type: 'Duplicate Listing', count: 6 },
  { type: 'Identity Fraud', count: 4 },
  { type: 'Other', count: 2 },
]
