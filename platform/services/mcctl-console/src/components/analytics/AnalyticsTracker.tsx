'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ANALYTICS_BASE, normalizePath } from '@/lib/analytics-path';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function gtag(..._args: unknown[]) {
  // gtag.js only understands `arguments` objects, not arrays.
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer = window.dataLayer || []).push(arguments);
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const path = normalizePath(pathname ?? '/');
    gtag('set', {
      page_location: ANALYTICS_BASE + path,
      page_referrer: ANALYTICS_BASE + (prev.current ?? '/'),
    });
    gtag('event', 'page_view');
    prev.current = path;
  }, [pathname]);

  return null;
}
