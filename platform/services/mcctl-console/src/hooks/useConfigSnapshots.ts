import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  ConfigSnapshotListResponse,
  ConfigSnapshotItem,
} from '@/ports/api/IMcctlApiClient';

/**
 * Hook to fetch config snapshots for a server
 */
export function useConfigSnapshots(
  serverName: string,
  limit: number = 20,
  offset: number = 0,
  options?: { enabled?: boolean }
) {
  return useQuery<ConfigSnapshotListResponse, Error>({
    queryKey: ['config-snapshots', 'list', serverName, limit, offset],
    queryFn: () =>
      apiFetch<ConfigSnapshotListResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/config-snapshots?limit=${limit}&offset=${offset}`
      ),
    enabled: options?.enabled !== false && !!serverName,
    refetchInterval: 60000,
  });
}

/**
 * Hook to create a new config snapshot
 */
export function useCreateConfigSnapshot() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfigSnapshotItem,
    Error,
    { serverName: string; description?: string }
  >({
    mutationFn: ({ serverName, description }) =>
      apiFetch<ConfigSnapshotItem>(
        `/api/servers/${encodeURIComponent(serverName)}/config-snapshots`,
        {
          method: 'POST',
          body: JSON.stringify({ description }),
        }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['config-snapshots', 'list', serverName] });
      // Also invalidate any "all servers" summary queries
      queryClient.invalidateQueries({ queryKey: ['config-snapshots'] });
    },
  });
}
