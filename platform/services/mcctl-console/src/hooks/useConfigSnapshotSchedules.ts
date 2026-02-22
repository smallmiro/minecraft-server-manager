import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  ConfigSnapshotScheduleListResponse,
  ConfigSnapshotScheduleItem,
  CreateConfigSnapshotScheduleRequest,
  UpdateConfigSnapshotScheduleRequest,
} from '@/ports/api/IMcctlApiClient';

/**
 * Hook to fetch all config snapshot schedules
 */
export function useConfigSnapshotSchedules(serverName?: string) {
  const params = serverName ? `?serverName=${encodeURIComponent(serverName)}` : '';
  return useQuery<ConfigSnapshotScheduleListResponse, Error>({
    queryKey: ['config-snapshot-schedules', serverName || 'all'],
    queryFn: () =>
      apiFetch<ConfigSnapshotScheduleListResponse>(
        `/api/config-snapshot-schedules${params}`
      ),
    refetchInterval: 60000,
  });
}

/**
 * Hook to create a config snapshot schedule
 */
export function useCreateConfigSnapshotSchedule() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfigSnapshotScheduleItem,
    Error,
    CreateConfigSnapshotScheduleRequest
  >({
    mutationFn: (data) =>
      apiFetch<ConfigSnapshotScheduleItem>('/api/config-snapshot-schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-snapshot-schedules'] });
    },
  });
}

/**
 * Hook to update a config snapshot schedule
 */
export function useUpdateConfigSnapshotSchedule() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfigSnapshotScheduleItem,
    Error,
    { id: string; data: UpdateConfigSnapshotScheduleRequest }
  >({
    mutationFn: ({ id, data }) =>
      apiFetch<ConfigSnapshotScheduleItem>(
        `/api/config-snapshot-schedules/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-snapshot-schedules'] });
    },
  });
}

/**
 * Hook to toggle a config snapshot schedule
 */
export function useToggleConfigSnapshotSchedule() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfigSnapshotScheduleItem,
    Error,
    { id: string; enabled: boolean }
  >({
    mutationFn: ({ id, enabled }) =>
      apiFetch<ConfigSnapshotScheduleItem>(
        `/api/config-snapshot-schedules/${encodeURIComponent(id)}/toggle`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-snapshot-schedules'] });
    },
  });
}

/**
 * Hook to delete a config snapshot schedule
 */
export function useDeleteConfigSnapshotSchedule() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(
        `/api/config-snapshot-schedules/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-snapshot-schedules'] });
    },
  });
}
