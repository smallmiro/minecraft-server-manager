'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

interface SessionProviderProps {
  children: React.ReactNode;
}

/**
 * Client-side session provider wrapper for NextAuth.js
 *
 * This component wraps the NextAuth SessionProvider to provide
 * session context to all client components. Must be used in a
 * 'use client' component.
 *
 * @example
 * // In layout.tsx
 * <SessionProvider>
 *   {children}
 * </SessionProvider>
 *
 * // In any client component
 * const { data: session, status } = useSession();
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
