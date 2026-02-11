import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  PlayitAgentStatus,
  PlayitActionResponse,
} from '@/ports/api/IMcctlApiClient';

/**
 * Hook to fetch playit.gg agent status
 */
export function usePlayitStatus() {
  return useQuery<PlayitAgentStatus, Error>({
    queryKey: ['playit-status'],
    queryFn: () => apiFetch<PlayitAgentStatus>('/api/playit/status'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to start playit-agent
 */
export function useStartPlayit() {
  const queryClient = useQueryClient();

  return useMutation<PlayitActionResponse, Error, void>({
    mutationFn: () =>
      apiFetch<PlayitActionResponse>('/api/playit/start', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playit-status'] });
    },
  });
}

/**
 * Hook to stop playit-agent
 */
export function useStopPlayit() {
  const queryClient = useQueryClient();

  return useMutation<PlayitActionResponse, Error, void>({
    mutationFn: () =>
      apiFetch<PlayitActionResponse>('/api/playit/stop', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playit-status'] });
    },
  });
}
