import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type { RestoreSnapshotOptions, RestoreConfigSnapshotResponse } from '@/ports/api/IMcctlApiClient';

interface RestoreConfigSnapshotInput {
  serverName: string;
  snapshotId: string;
  options?: RestoreSnapshotOptions;
}

/**
 * Hook to restore a server's configuration from a snapshot
 *
 * Sends POST /api/servers/:name/config-snapshots/:id/restore
 * Optionally creates a safety snapshot before restoring (default: true)
 */
export function useRestoreConfigSnapshot() {
  const queryClient = useQueryClient();

  return useMutation<RestoreConfigSnapshotResponse, Error, RestoreConfigSnapshotInput>({
    mutationFn: ({ serverName, snapshotId, options }) =>
      apiFetch<RestoreConfigSnapshotResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/config-snapshots/${encodeURIComponent(snapshotId)}/restore`,
        {
          method: 'POST',
          body: JSON.stringify({
            createSnapshotBeforeRestore: options?.createSnapshotBeforeRestore ?? true,
            force: options?.force ?? false,
          }),
        }
      ),
    onSuccess: (_, { serverName }) => {
      // Invalidate snapshot list so newly created safety snapshot appears
      queryClient.invalidateQueries({ queryKey: ['config-snapshots', 'list', serverName] });
      // Invalidate server details since config has changed
      queryClient.invalidateQueries({ queryKey: ['servers', serverName] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'config'] });
    },
  });
}
