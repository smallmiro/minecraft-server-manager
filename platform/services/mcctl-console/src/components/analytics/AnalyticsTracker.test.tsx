import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

let pathname = '/dashboard';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { AnalyticsTracker } from './AnalyticsTracker';

describe('AnalyticsTracker', () => {
  beforeEach(() => {
    (window as any).dataLayer = undefined;
    pathname = '/dashboard';
  });

  it('pushes set then page_view (as arguments objects) on mount and path change', () => {
    const { rerender } = render(<AnalyticsTracker />);
    pathname = '/servers/foo/console';
    rerender(<AnalyticsTracker />);
    const dl = (window as any).dataLayer.map((a: IArguments) => Array.from(a));
    expect(dl).toEqual([
      ['set', { page_location: 'http://mcctl-console.invalid/dashboard', page_referrer: 'http://mcctl-console.invalid/' }],
      ['event', 'page_view'],
      ['set', { page_location: 'http://mcctl-console.invalid/servers/:name/console', page_referrer: 'http://mcctl-console.invalid/dashboard' }],
      ['event', 'page_view'],
    ]);
    expect(Array.isArray((window as any).dataLayer[0])).toBe(false);
  });
});
