import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  ServerListResponse,
  ServerDetailResponse,
  CreateServerRequest,
  CreateServerResponse,
  DeleteServerResponse,
  ActionResponse,
  ExecCommandResponse,
  LogsResponse,
  WorldListResponse,
  WorldDetailResponse,
  CreateWorldRequest,
  CreateWorldResponse,
  AssignWorldResponse,
  ReleaseWorldResponse,
  DeleteWorldResponse,
  ServerConfigResponse,
  UpdateServerConfigRequest,
  UpdateServerConfigResponse,
  WorldResetResponse,
  RouterStatusResponse,
  BackupStatusResponse,
  BackupPushResponse,
  BackupHistoryResponse,
  BackupRestoreResponse,
} from '@/ports/api/IMcctlApiClient';

// ============================================================
// Server Hooks
// ============================================================

/**
 * Hook to fetch all servers
 * Note: Polling is reduced since SSE provides real-time updates
 */
export function useServers() {
  return useQuery<ServerListResponse, Error>({
    queryKey: ['servers'],
    queryFn: () => apiFetch<ServerListResponse>('/api/servers'),
    refetchInterval: 60000, // Reduced to 60 seconds (SSE provides real-time updates)
  });
}

/**
 * Hook to fetch a single server
 * Note: Polling is reduced since SSE provides real-time status updates
 */
export function useServer(name: string, options?: { enabled?: boolean }) {
  return useQuery<ServerDetailResponse, Error>({
    queryKey: ['servers', name],
    queryFn: () => apiFetch<ServerDetailResponse>(`/api/servers/${encodeURIComponent(name)}`),
    enabled: options?.enabled !== false && !!name,
    refetchInterval: 30000, // Reduced to 30 seconds (SSE provides real-time status)
  });
}

/**
 * Hook to create a new server
 */
export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation<CreateServerResponse, Error, CreateServerRequest>({
    mutationFn: (data) =>
      apiFetch<CreateServerResponse>('/api/servers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

/**
 * Hook to delete a server
 */
export function useDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation<DeleteServerResponse, Error, { name: string; force?: boolean }>({
    mutationFn: ({ name, force }) =>
      apiFetch<DeleteServerResponse>(
        `/api/servers/${encodeURIComponent(name)}${force ? '?force=true' : ''}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

/**
 * Hook to start a server
 */
export function useStartServer() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, string>({
    mutationFn: (name) =>
      apiFetch<ActionResponse>(`/api/servers/${encodeURIComponent(name)}/start`, {
        method: 'POST',
      }),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', name] });
    },
  });
}

/**
 * Hook to stop a server
 */
export function useStopServer() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, string>({
    mutationFn: (name) =>
      apiFetch<ActionResponse>(`/api/servers/${encodeURIComponent(name)}/stop`, {
        method: 'POST',
      }),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', name] });
    },
  });
}

/**
 * Hook to restart a server
 */
export function useRestartServer() {
  const queryClient = useQueryClient();

  return useMutation<ActionResponse, Error, string>({
    mutationFn: (name) =>
      apiFetch<ActionResponse>(`/api/servers/${encodeURIComponent(name)}/restart`, {
        method: 'POST',
      }),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', name] });
    },
  });
}

/**
 * Hook to execute RCON command
 */
export function useExecCommand() {
  return useMutation<ExecCommandResponse, Error, { serverName: string; command: string }>({
    mutationFn: ({ serverName, command }) =>
      apiFetch<ExecCommandResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/exec`,
        {
          method: 'POST',
          body: JSON.stringify({ command }),
        }
      ),
  });
}

/**
 * Hook to fetch server logs
 * Note: This is deprecated in favor of useServerLogs SSE hook
 * Only used for initial data or when SSE is not available
 */
export function useServerLogs(serverName: string, lines: number = 100, options?: { enabled?: boolean }) {
  return useQuery<LogsResponse, Error>({
    queryKey: ['servers', serverName, 'logs', lines],
    queryFn: () =>
      apiFetch<LogsResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/logs?lines=${lines}`
      ),
    enabled: options?.enabled !== false && !!serverName,
    refetchInterval: false, // Disabled - use useServerLogs SSE hook instead
  });
}

// ============================================================
// World Hooks
// ============================================================

/**
 * Hook to fetch all worlds
 */
export function useWorlds() {
  return useQuery<WorldListResponse, Error>({
    queryKey: ['worlds'],
    queryFn: () => apiFetch<WorldListResponse>('/api/worlds'),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch a single world
 */
export function useWorld(name: string, options?: { enabled?: boolean }) {
  return useQuery<WorldDetailResponse, Error>({
    queryKey: ['worlds', name],
    queryFn: () => apiFetch<WorldDetailResponse>(`/api/worlds/${encodeURIComponent(name)}`),
    enabled: options?.enabled !== false && !!name,
  });
}

/**
 * Hook to create a new world
 */
export function useCreateWorld() {
  const queryClient = useQueryClient();

  return useMutation<CreateWorldResponse, Error, CreateWorldRequest>({
    mutationFn: (data) =>
      apiFetch<CreateWorldResponse>('/api/worlds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
    },
  });
}

/**
 * Hook to assign world to server
 */
export function useAssignWorld() {
  const queryClient = useQueryClient();

  return useMutation<AssignWorldResponse, Error, { worldName: string; serverName: string }>({
    mutationFn: ({ worldName, serverName }) =>
      apiFetch<AssignWorldResponse>(
        `/api/worlds/${encodeURIComponent(worldName)}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({ serverName }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

/**
 * Hook to release world lock
 */
export function useReleaseWorld() {
  const queryClient = useQueryClient();

  return useMutation<ReleaseWorldResponse, Error, { worldName: string; force?: boolean }>({
    mutationFn: ({ worldName, force }) =>
      apiFetch<ReleaseWorldResponse>(
        `/api/worlds/${encodeURIComponent(worldName)}/release${force ? '?force=true' : ''}`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
    },
  });
}

/**
 * Hook to delete a world
 */
export function useDeleteWorld() {
  const queryClient = useQueryClient();

  return useMutation<DeleteWorldResponse, Error, { name: string; force?: boolean }>({
    mutationFn: ({ name, force }) =>
      apiFetch<DeleteWorldResponse>(
        `/api/worlds/${encodeURIComponent(name)}${force ? '?force=true' : ''}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
    },
  });
}

// ============================================================
// Server Configuration Hooks
// ============================================================

/**
 * Hook to fetch server configuration
 */
export function useServerConfig(serverName: string, options?: { enabled?: boolean }) {
  return useQuery<ServerConfigResponse, Error>({
    queryKey: ['servers', serverName, 'config'],
    queryFn: () =>
      apiFetch<ServerConfigResponse>(`/api/servers/${encodeURIComponent(serverName)}/config`),
    enabled: options?.enabled !== false && !!serverName,
  });
}

/**
 * Hook to update server configuration
 */
export function useUpdateServerConfig() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateServerConfigResponse,
    Error,
    { serverName: string; config: UpdateServerConfigRequest }
  >({
    mutationFn: ({ serverName, config }) =>
      apiFetch<UpdateServerConfigResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/config`,
        {
          method: 'PATCH',
          body: JSON.stringify(config),
        }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'config'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverName] });
    },
  });
}

/**
 * Hook to reset world
 */
export function useResetWorld() {
  const queryClient = useQueryClient();

  return useMutation<WorldResetResponse, Error, string>({
    mutationFn: (serverName) =>
      apiFetch<WorldResetResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/world/reset`,
        { method: 'POST' }
      ),
    onSuccess: (_, serverName) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName] });
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
    },
  });
}

// ============================================================
// Router Hooks
// ============================================================

/**
 * Hook to fetch router status
 */
export function useRouterStatus() {
  return useQuery<RouterStatusResponse, Error>({
    queryKey: ['router-status'],
    queryFn: () => apiFetch<RouterStatusResponse>('/api/router/status'),
    refetchInterval: 30000,
  });
}

// ============================================================
// Backup Hooks
// ============================================================

/**
 * Hook to fetch backup status
 */
export function useBackupStatus() {
  return useQuery<BackupStatusResponse, Error>({
    queryKey: ['backup-status'],
    queryFn: () => apiFetch<BackupStatusResponse>('/api/backup'),
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook to fetch backup history
 */
export function useBackupHistory(limit: number = 20) {
  return useQuery<BackupHistoryResponse, Error>({
    queryKey: ['backup-history', limit],
    queryFn: () => apiFetch<BackupHistoryResponse>(`/api/backup/history?limit=${limit}`),
    refetchInterval: 60000,
  });
}

/**
 * Hook to push backup
 */
export function usePushBackup() {
  const queryClient = useQueryClient();

  return useMutation<BackupPushResponse, Error, { message?: string }>({
    mutationFn: ({ message }) =>
      apiFetch<BackupPushResponse>('/api/backup', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
    },
  });
}

/**
 * Hook to restore backup
 */
export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation<BackupRestoreResponse, Error, string>({
    mutationFn: (commitHash) =>
      apiFetch<BackupRestoreResponse>('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ commitHash }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}
