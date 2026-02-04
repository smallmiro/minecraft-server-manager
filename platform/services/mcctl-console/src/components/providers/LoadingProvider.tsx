/**
 * Loading Provider Component
 * Shows a loading bar during page navigation
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  speed: 300,
  minimum: 0.1,
});

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  return <>{children}</>;
}

/**
 * Start the loading bar manually
 */
export function startLoading() {
  NProgress.start();
}

/**
 * Stop the loading bar manually
 */
export function stopLoading() {
  NProgress.done();
}
