'use client';

import { createAuthClient } from 'better-auth/react';
import { adminClient as adminPlugin } from 'better-auth/client/plugins';

/**
 * Better Auth client for browser/React usage
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || '',
  plugins: [
    adminPlugin(),
  ],
});

// Export hooks and methods for convenience
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  updateUser,
  changePassword,
} = authClient;

// Export admin client
export const adminClient = authClient.admin;

// Type exports
export type AuthClient = typeof authClient;
