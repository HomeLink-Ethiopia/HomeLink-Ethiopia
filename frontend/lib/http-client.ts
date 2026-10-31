/**
 * HTTP Client for API Communication
 *
 * Provides a centralized layer for making API requests with:
 * - Automatic error handling and typing
 * - Request/response logging for debugging
 * - Timeout management
 * - Response caching (optional)
 * - Retry logic for failed requests
 */

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
  cache?: 'no-cache' | 'force-cache' | 'default'
}

export interface HttpResponse<T> {
  data: T
  status: number
  headers: Record<string, string>
}

export interface ApiError {
  status: number
  message: string
  details?: any
}

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const DEFAULT_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10)

/**
 * Get JWT token from localStorage (browser only)
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('hl_token')
}

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[HTTP Client]', ...args)
  }
}

function logError(...args: any[]) {
  console.error('[HTTP Client Error]', ...args)
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller
}

/**
 * Parse error response body safely
 */
async function parseErrorBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type')
  try {
    if (contentType?.includes('application/json')) {
      return await response.json()
    }
    return await response.text()
  } catch {
    return null
  }
}

/**
 * Main HTTP request function
 */
export async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<HttpResponse<T>> {
  const {
    method = 'GET',
    headers: customHeaders = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = 1,
    cache = 'default',
  } = config

  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`
  const controller = createTimeoutController(timeout)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  // Auto-attach JWT token if available
  const token = getAuthToken()
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const fetchConfig: RequestInit = {
    method,
    headers,
    signal: controller.signal,
    cache: cache as RequestCache,
  }

  if (body) {
    fetchConfig.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  log(`${method} ${url}`, body ? { body } : '')

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, fetchConfig)

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      let data: T

      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          data = await response.json()
        } else {
          data = (await response.text()) as unknown as T
        }

        log(`${method} ${url} ✓ Status: ${response.status}`, data)

        return {
          data,
          status: response.status,
          headers: responseHeaders,
        }
      } else {
        // Handle error response
        const errorBody = await parseErrorBody(response)
        const message =
          errorBody?.message ||
          errorBody?.error ||
          `HTTP ${response.status}: ${response.statusText}`

        const error: ApiError = {
          status: response.status,
          message,
          details: errorBody,
        }

        logError(
          `${method} ${url} ✗ Status: ${response.status}`,
          error.message,
          errorBody
        )

        // Don't retry for 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw error
        }

        // For 5xx errors, retry if attempts remain
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          log(`Retrying in ${delay}ms... (attempt ${attempt + 2}/${retries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        throw error
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeout}ms`)
        } else {
          lastError = error
        }
      } else {
        lastError = new Error(String(error))
      }

      logError(`${method} ${url} ✗ Error:`, lastError.message)

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        log(`Retrying in ${delay}ms... (attempt ${attempt + 2}/${retries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`)
}

/**
 * Convenience methods for common HTTP verbs
 */

export async function get<T>(
  endpoint: string,
  config?: Omit<RequestConfig, 'method' | 'body'>
): Promise<HttpResponse<T>> {
  return request<T>(endpoint, { ...config, method: 'GET' })
}

export async function post<T>(
  endpoint: string,
  body?: any,
  config?: Omit<RequestConfig, 'method' | 'body'>
): Promise<HttpResponse<T>> {
  return request<T>(endpoint, { ...config, method: 'POST', body })
}

export async function put<T>(
  endpoint: string,
  body?: any,
  config?: Omit<RequestConfig, 'method' | 'body'>
): Promise<HttpResponse<T>> {
  return request<T>(endpoint, { ...config, method: 'PUT', body })
}

export async function patch<T>(
  endpoint: string,
  body?: any,
  config?: Omit<RequestConfig, 'method' | 'body'>
): Promise<HttpResponse<T>> {
  return request<T>(endpoint, { ...config, method: 'PATCH', body })
}

export async function del<T>(
  endpoint: string,
  config?: Omit<RequestConfig, 'method' | 'body'>
): Promise<HttpResponse<T>> {
  return request<T>(endpoint, { ...config, method: 'DELETE' })
}

/**
 * Create a typed API client instance with base URL and common configuration
 */
export function createApiClient(baseUrl?: string, defaultConfig?: RequestConfig) {
  const url = baseUrl || API_URL

  return {
    request: <T,>(endpoint: string, config?: RequestConfig) =>
      request<T>(endpoint, { ...defaultConfig, ...config }),
    get: <T,>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
      get<T>(endpoint, config),
    post: <T,>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>) =>
      post<T>(endpoint, body, config),
    put: <T,>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>) =>
      put<T>(endpoint, body, config),
    patch: <T,>(
      endpoint: string,
      body?: any,
      config?: Omit<RequestConfig, 'method' | 'body'>
    ) => patch<T>(endpoint, body, config),
    delete: <T,>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
      del<T>(endpoint, config),
  }
}
