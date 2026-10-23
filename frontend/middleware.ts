import { NextRequest, NextResponse } from 'next/server'

/**
 * Authentication middleware that protects role-specific routes.
 * 
 * Protected routes require a valid session cookie (`session_role`).
 * Users without a session are redirected to the login page.
 * 
 * Role-specific access:
 * - /tenant/* requires session_role=tenant
 * - /landlord/* requires session_role=landlord  
 * - /admin/* requires session_role=admin
 * 
 * Public routes (/, /login, /signup, etc.) are always accessible.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionRole = request.cookies.get('session_role')?.value

  // Check if accessing a protected route
  const isProtectedRoute = 
    pathname.startsWith('/tenant') ||
    pathname.startsWith('/landlord') ||
    pathname.startsWith('/admin')

  if (isProtectedRoute) {
    // No session - redirect to login
    if (!sessionRole) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Verify role matches route
    if (pathname.startsWith('/tenant') && sessionRole !== 'tenant') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname.startsWith('/landlord') && sessionRole !== 'landlord') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname.startsWith('/admin') && sessionRole !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tenant/:path*', '/landlord/:path*', '/admin/:path*'],
}
