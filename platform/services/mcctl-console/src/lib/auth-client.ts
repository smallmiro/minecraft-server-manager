'use client';

import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for browser/React usage
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:5000',
  plugins: [
    adminClient(),
  ],
});

// Export hooks and methods for convenience
export const {
  signIn,
  signOut,
  signUp,
  useSession,
} = authClient;

// Type exports
export type AuthClient = typeof authClient;
