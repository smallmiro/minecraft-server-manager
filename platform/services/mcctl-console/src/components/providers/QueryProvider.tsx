'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * React Query provider with optimized default options
 *
 * Features:
 * - Prevents server-side rendering issues with useState
 * - Configures sensible retry and stale time defaults
 * - Provides query client to all child components
 *
 * @example
 * // In layout.tsx
 * <QueryProvider>
 *   {children}
 * </QueryProvider>
 *
 * // In any component
 * const { data, isLoading } = useQuery({
 *   queryKey: ['servers', name],
 *   queryFn: () => serverApi.getServer(name),
 * });
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000, // Data considered fresh for 5 seconds
            refetchOnWindowFocus: true,
            retry: 1,
            refetchOnMount: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
