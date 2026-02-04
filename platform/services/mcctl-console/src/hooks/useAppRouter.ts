/**
 * Custom router hook that triggers loading bar on navigation
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { startLoading } from '@/components/providers';

/**
 * Wrapper around Next.js useRouter that automatically shows loading bar
 */
export function useAppRouter() {
  const router = useRouter();

  const push = useCallback(
    (href: string, options?: Parameters<typeof router.push>[1]) => {
      startLoading();
      router.push(href, options);
    },
    [router]
  );

  const replace = useCallback(
    (href: string, options?: Parameters<typeof router.replace>[1]) => {
      startLoading();
      router.replace(href, options);
    },
    [router]
  );

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
    }),
    [router, push, replace]
  );
}
