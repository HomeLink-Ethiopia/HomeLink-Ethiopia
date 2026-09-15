/**
 * API Configuration & Endpoint Constants
 *
 * Centralized management of all API endpoints used in the application.
 * Makes it easy to update endpoints and maintain consistency across the codebase.
 */

export const API_ENDPOINTS = {
  // Properties
  PROPERTIES: '/api/properties',
  PROPERTY_DETAIL: (id: string) => `/api/properties/${id}`,
  SUBMIT_PROPERTY: '/api/properties/submit',
  VERIFY_PROPERTY: (id: string) => `/api/properties/${id}/verify`,

  // Viewings
  VIEWING_REQUESTS: '/api/viewings/requests',
  SUBMIT_VIEWING: '/api/viewings/request',
  UPDATE_VIEWING: (id: string) => `/api/viewings/${id}`,

  // Applications
  APPLICATIONS: '/api/applications',
  SUBMIT_APPLICATION: '/api/applications/submit',
  GET_APPLICATION: (id: string) => `/api/applications/${id}`,

  // Maintenance
  MAINTENANCE_REQUESTS: '/api/maintenance',
  SUBMIT_MAINTENANCE: '/api/maintenance/request',
  GET_MAINTENANCE: (id: string) => `/api/maintenance/${id}`,
  UPDATE_MAINTENANCE: (id: string) => `/api/maintenance/${id}`,

  // Fraud Reports
  FRAUD_REPORTS: '/api/fraud/reports',
  SUBMIT_FRAUD_REPORT: '/api/fraud/report',
  GET_FRAUD_REPORT: (id: string) => `/api/fraud/reports/${id}`,

  // Disputes
  DISPUTES: '/api/disputes',
  SUBMIT_DISPUTE: '/api/disputes/submit',
  GET_DISPUTE: (id: string) => `/api/disputes/${id}`,

  // Authentication (if using API-based auth)
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  LOGOUT: '/api/auth/logout',
  REFRESH_TOKEN: '/api/auth/refresh',

  // User Profile
  GET_PROFILE: '/api/users/profile',
  UPDATE_PROFILE: '/api/users/profile',
  CHANGE_PASSWORD: '/api/users/password',

  // Admin
  ADMIN_DASHBOARD: '/api/admin/dashboard',
  ADMIN_QUEUE: '/api/admin/queue',
  ADMIN_DISPUTES: '/api/admin/disputes',
  ADMIN_FRAUD_REPORTS: '/api/admin/fraud-reports',
  ADMIN_MARKET_INSIGHTS: '/api/admin/market-insights',
} as const

/**
 * API Response Types
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ErrorResponse {
  status: number
  message: string
  details?: Record<string, any>
  timestamp: string
}

/**
 * Common Request Headers
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const

/**
 * Timeout values for different types of requests
 */
export const REQUEST_TIMEOUTS = {
  SHORT: 5000, // For quick operations like status checks
  DEFAULT: 30000, // Standard request timeout
  LONG: 60000, // For file uploads or heavy operations
} as const

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // Start with 1 second
  MAX_DELAY: 10000, // Cap at 10 seconds
} as const

/**
 * HTTP Status Codes
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * Check if status code represents a client error
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500
}

/**
 * Check if status code represents a server error
 */
export function isServerError(status: number): boolean {
  return status >= 500 && status < 600
}

/**
 * Check if status code is retryable
 */
export function isRetryable(status: number): boolean {
  // Don't retry 4xx errors (except 429 Too Many Requests)
  if (isClientError(status) && status !== 429) {
    return false
  }
  // Retry 5xx errors and 429
  return true
}
