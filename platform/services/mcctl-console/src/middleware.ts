import { NextRequest, NextResponse } from 'next/server';

/**
 * Session cookie name used by Better Auth
 * This matches the default cookie name from better-auth
 */
const SESSION_COOKIE_NAME = 'better-auth.session_token';

/**
 * Routes that require authentication
 */
const protectedRoutes = ['/dashboard', '/servers', '/worlds', '/players', '/backups', '/routing', '/audit-logs'];

/**
 * Routes that require admin role
 * Note: Admin role check is done in page/API level, not middleware
 * Middleware only checks for session existence
 */
const adminRoutes = ['/admin'];

/**
 * Public routes (accessible without authentication)
 */
const publicRoutes = ['/login', '/signup'];

/**
 * Check if a session cookie exists
 * Note: This only checks cookie existence, not validity
 * Full session validation happens in pages/API routes with Node.js runtime
 */
function hasSessionCookie(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  return !!sessionCookie?.value;
}

/**
 * Middleware for route protection and authentication
 *
 * This middleware runs in Edge runtime and can only check for cookie existence.
 * Full session validation (including role checks) must be done in pages/API routes
 * which run in Node.js runtime and can access the database.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie (lightweight check, no database access)
  const hasSession = hasSessionCookie(request);

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Redirect to login if accessing protected route without session cookie
  if (isProtectedRoute && !hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to login if accessing admin route without session cookie
  // Note: Admin role validation happens in the admin page itself
  if (isAdminRoute && !hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing login/signup while having session cookie
  if (isPublicRoute && hasSession) {
    const from = request.nextUrl.searchParams.get('from');
    const url = new URL(from || '/dashboard', request.url);
    return NextResponse.redirect(url);
  }

  // Allow access
  return NextResponse.next();
}

/**
 * Matcher configuration
 * Apply middleware to all routes except static files and API routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
