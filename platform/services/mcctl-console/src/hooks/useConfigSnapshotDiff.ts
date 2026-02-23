import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type { ConfigSnapshotDiffResponse } from '@/ports/api/IMcctlApiClient';

/**
 * Hook to fetch the diff between two config snapshots
 *
 * @param snapshotId1 - Base snapshot ID
 * @param snapshotId2 - Compare snapshot ID
 * @param options - Optional configuration
 */
export function useConfigSnapshotDiff(
  snapshotId1: string,
  snapshotId2: string,
  options?: { enabled?: boolean }
) {
  return useQuery<ConfigSnapshotDiffResponse, Error>({
    queryKey: ['config-snapshots', 'diff', snapshotId1, snapshotId2],
    queryFn: () =>
      apiFetch<ConfigSnapshotDiffResponse>(
        `/api/config-snapshots/${encodeURIComponent(snapshotId1)}/diff/${encodeURIComponent(snapshotId2)}`
      ),
    enabled: options?.enabled !== false && !!snapshotId1 && !!snapshotId2,
    staleTime: 5 * 60 * 1000, // 5 minutes - diffs are static for existing snapshots
  });
}
