import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type { ConfigSnapshotListResponse } from '@/ports/api/IMcctlApiClient';

const PAGE_SIZE = 10;

/**
 * Hook to fetch config snapshots for a specific server with infinite pagination.
 *
 * Uses React Query's useInfiniteQuery for "Load More" functionality.
 *
 * @param serverName - Name of the server to fetch snapshots for
 * @param options - Optional configuration
 */
export function useServerConfigSnapshots(
  serverName: string,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery<ConfigSnapshotListResponse, Error>({
    queryKey: ['config-snapshots', 'list', serverName],
    queryFn: ({ pageParam = 0 }) =>
      apiFetch<ConfigSnapshotListResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/config-snapshots?limit=${PAGE_SIZE}&offset=${pageParam as number}`
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((acc, page) => acc + page.snapshots.length, 0);
      if (fetched >= lastPage.total) return undefined;
      return fetched;
    },
    enabled: options?.enabled !== false && !!serverName,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
