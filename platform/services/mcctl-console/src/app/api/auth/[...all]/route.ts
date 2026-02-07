import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const dynamic = 'force-dynamic';

/**
 * Better Auth API route handler
 * Handles all /api/auth/* requests
 */
export const { GET, POST } = toNextJsHandler(auth);
