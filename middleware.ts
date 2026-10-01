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

  // Bypass static files, api routes, and next internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const isTenantRoute = pathname.startsWith('/tenant')
  const isLandlordRoute = pathname.startsWith('/landlord')
  const isAdminRoute = pathname.startsWith('/admin')
  const isProtectedRoute = isTenantRoute || isLandlordRoute || isAdminRoute

  if (isProtectedRoute) {
    // No session - redirect to login
    if (!sessionRole) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Verify role matches route
    if (isTenantRoute && sessionRole !== 'tenant') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (isLandlordRoute && sessionRole !== 'landlord') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (isAdminRoute && sessionRole !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } else {
    // Marketing/Public routes
    const PUBLIC_PAGES = [
      '/',
      '/explore',
      '/about',
      '/how-it-works',
      '/for-landlords',
      '/get-started',
      '/list-property',
      '/support',
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/verify-email'
    ]

    // We also want to redirect if the exact route matches or if it's the root public area,
    // but allow property details (/property/[id]) to be accessed.
    const isPublicAuthPage =
      PUBLIC_PAGES.includes(pathname) ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup')

    if (sessionRole && isPublicAuthPage) {
      if (sessionRole === 'tenant') return NextResponse.redirect(new URL('/tenant/dashboard', request.url))
      if (sessionRole === 'landlord') return NextResponse.redirect(new URL('/landlord/dashboard', request.url))
      if (sessionRole === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on all paths so we can intercept public pages too
  matcher: ['/((?!api|_next/static|_next/image|images|favicon.ico).*)'],
}
