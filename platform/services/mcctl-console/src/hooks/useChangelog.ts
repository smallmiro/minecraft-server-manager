'use client';

import { useQuery } from '@tanstack/react-query';
import type { ChangelogVersion } from '@/lib/changelog';

export const CHANGELOG_KEY = ['changelog'] as const;

export interface ChangelogResponse {
  latest: ChangelogVersion;
  installedVersion: string;
  fetchedAt: string;
  stale: boolean;
}

async function fetchChangelog(): Promise<ChangelogResponse> {
  const response = await fetch('/api/changelog', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Unable to load updates');
  }
  return response.json();
}

/** Latest changelog entry + installed version from the BFF (server caches ~1h). */
export function useChangelog() {
  return useQuery<ChangelogResponse, Error>({
    queryKey: CHANGELOG_KEY,
    queryFn: fetchChangelog,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
