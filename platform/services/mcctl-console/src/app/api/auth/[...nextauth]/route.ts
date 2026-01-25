import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * NextAuth.js API route handler for App Router
 *
 * Handles all authentication endpoints:
 * - GET /api/auth/signin
 * - POST /api/auth/signin
 * - GET /api/auth/signout
 * - POST /api/auth/signout
 * - GET /api/auth/session
 * - GET /api/auth/providers
 * - GET /api/auth/csrf
 * - POST /api/auth/callback/credentials
 *
 * @see https://next-auth.js.org/configuration/initialization#route-handlers-app
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
