import { NextRequest, NextResponse } from 'next/server';
import { auth } from './lib/auth';

/**
 * Routes that require authentication
 */
const protectedRoutes = ['/dashboard', '/servers', '/worlds', '/players', '/backups', '/settings'];

/**
 * Routes that require admin role
 */
const adminRoutes = ['/admin'];

/**
 * Public routes (accessible without authentication)
 */
const publicRoutes = ['/login', '/signup'];

/**
 * Middleware for route protection and authentication
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Redirect to login if accessing protected route without authentication
  if (isProtectedRoute && !session) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to login if accessing admin route without authentication
  if (isAdminRoute && !session) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing admin route without admin role
  if (isAdminRoute && session && session.user.role !== 'admin') {
    const url = new URL('/dashboard', request.url);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing login/signup while authenticated
  if (isPublicRoute && session) {
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
