import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';

interface DeleteConfigSnapshotInput {
  serverName: string;
  snapshotId: string;
}

/**
 * Hook to delete a config snapshot.
 *
 * Sends DELETE /api/servers/:name/config-snapshots/:id
 * Invalidates the snapshot list on success.
 */
export function useDeleteConfigSnapshot() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteConfigSnapshotInput>({
    mutationFn: ({ serverName, snapshotId }) =>
      apiFetch<void>(
        `/api/servers/${encodeURIComponent(serverName)}/config-snapshots/${encodeURIComponent(snapshotId)}`,
        { method: 'DELETE' }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['config-snapshots', 'list', serverName] });
      // Also invalidate the global config-snapshots summary
      queryClient.invalidateQueries({ queryKey: ['config-snapshots'] });
    },
  });
}
