'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * React Query configuration
 */
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 30 seconds (data considered fresh)
        staleTime: 30 * 1000,
        // Retry failed queries up to 3 times
        retry: 3,
        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data exists
        refetchOnMount: false,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
      },
    },
  });

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Query Provider component
 *
 * Wraps the application with React Query's QueryClientProvider.
 * Creates a new QueryClient instance per session to avoid SSR issues.
 *
 * @example
 * <QueryProvider>
 *   <App />
 * </QueryProvider>
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient once per component instance to avoid sharing state
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
