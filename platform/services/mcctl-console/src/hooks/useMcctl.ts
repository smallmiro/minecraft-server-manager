import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import { consumeSseStream } from './sse';
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
  WorldInfoResponse,
  PlayerLocationsResponse,
  MapStatusResponse,
  MapRenderProgress,
  MapRenderRequest,
  MapMarkersResponse,
  BlockStatsResult,
  StatsAnalyzeProgress,
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
  BackupScheduleListResponse,
  BackupScheduleItem,
  CreateBackupScheduleRequest,
  UpdateBackupScheduleRequest,
  BackupScheduleActionResponse,
  HostnameResponse,
  UpdateHostnamesResponse,
  WhitelistResponse,
  WhitelistStatusResponse,
  PlayerActionResponse,
  PlayitAgentStatus,
  PlayitActionResponse,
  PlayitServerInfo,
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
 * Hook to fetch parsed world info (level.dat metadata + structure) (#525)
 */
export function useWorldInfo(name: string, options?: { enabled?: boolean }) {
  return useQuery<WorldInfoResponse, Error>({
    queryKey: ['worlds', name, 'info'],
    queryFn: () => apiFetch<WorldInfoResponse>(`/api/worlds/${encodeURIComponent(name)}/info`),
    enabled: options?.enabled !== false && !!name,
  });
}

/**
 * Hook to fetch offline player locations from playerdata (#525)
 */
export function useWorldPlayers(name: string, options?: { enabled?: boolean }) {
  return useQuery<PlayerLocationsResponse, Error>({
    queryKey: ['worlds', name, 'players'],
    queryFn: () => apiFetch<PlayerLocationsResponse>(`/api/worlds/${encodeURIComponent(name)}/players`),
    enabled: options?.enabled !== false && !!name,
  });
}

/**
 * Hook to poll live player locations via RCON (#525).
 * Polls every 5s; gracefully returns an empty list when the server is stopped.
 */
export function useLivePlayers(serverName: string, options?: { enabled?: boolean }) {
  return useQuery<PlayerLocationsResponse, Error>({
    queryKey: ['servers', serverName, 'players', 'live'],
    queryFn: () =>
      apiFetch<PlayerLocationsResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/players/live`
      ),
    enabled: options?.enabled !== false && !!serverName,
    refetchInterval: 5000,
  });
}

/**
 * Hook to fetch the rendered-map status for a world (#529).
 */
export function useMapStatus(name: string, options?: { enabled?: boolean }) {
  return useQuery<MapStatusResponse, Error>({
    queryKey: ['worlds', name, 'map', 'status'],
    queryFn: () =>
      apiFetch<MapStatusResponse>(`/api/worlds/${encodeURIComponent(name)}/map/status`),
    enabled: options?.enabled !== false && !!name,
  });
}

export interface UseRenderMapState {
  /** Trigger a render for the given world. */
  render: (name: string, request?: MapRenderRequest) => Promise<void>;
  isRendering: boolean;
  progress: MapRenderProgress | null;
  error: string | null;
}

/**
 * Hook to trigger a BlueMap render and stream progress via SSE (#529).
 *
 * Uses fetch (not EventSource, which is GET-only) to POST and read the
 * text/event-stream body, parsing `event:`/`data:` frames. On completion the
 * world's map-status query is invalidated so the viewer can refresh.
 */
export function useRenderMap() {
  const queryClient = useQueryClient();
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState<MapRenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(false);

  const render = useCallback(
    async (name: string, request?: MapRenderRequest) => {
      if (activeRef.current) return;
      activeRef.current = true;
      setIsRendering(true);
      setProgress(null);
      setError(null);

      try {
        const response = await fetch(
          `/api/worlds/${encodeURIComponent(name)}/map/render?follow=true`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request ?? {}),
          }
        );

        if (!response.ok || !response.body) {
          throw new Error(`Render failed (HTTP ${response.status})`);
        }

        await consumeSseStream(response, (event, payload) => {
          if (event === 'progress') setProgress(payload as MapRenderProgress);
          else if (event === 'error') {
            setError((payload as { message?: string }).message ?? 'Render failed');
          }
        });

        await queryClient.invalidateQueries({
          queryKey: ['worlds', name, 'map', 'status'],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Render failed');
      } finally {
        setIsRendering(false);
        activeRef.current = false;
      }
    },
    [queryClient]
  );

  return { render, isRendering, progress, error };
}

/**
 * Hook to write structure markers into the rendered map (#530).
 */
export function useWriteMapMarkers() {
  return useMutation<MapMarkersResponse, Error, string>({
    mutationFn: (name: string) =>
      apiFetch<MapMarkersResponse>(`/api/worlds/${encodeURIComponent(name)}/map/markers`, {
        method: 'POST',
      }),
  });
}

/**
 * Hook to fetch the cached block-stats analysis for a world (#531).
 * Errors with statusCode 404 when no analysis has been run yet.
 */
export function useWorldStats(name: string, options?: { enabled?: boolean }) {
  return useQuery<BlockStatsResult, Error>({
    queryKey: ['worlds', name, 'stats'],
    queryFn: () => apiFetch<BlockStatsResult>(`/api/worlds/${encodeURIComponent(name)}/stats`),
    enabled: options?.enabled !== false && !!name,
    retry: false,
  });
}

export interface UseAnalyzeStatsState {
  analyze: (name: string) => Promise<void>;
  isAnalyzing: boolean;
  progress: StatsAnalyzeProgress | null;
  error: string | null;
}

/**
 * Hook to run a world block-stats analysis and stream progress via SSE (#531).
 * Uses fetch (EventSource is GET-only) to POST and parse the event stream. On
 * completion the cached stats query is invalidated.
 */
export function useAnalyzeStats() {
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<StatsAnalyzeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(false);

  const analyze = useCallback(
    async (name: string) => {
      if (activeRef.current) return;
      activeRef.current = true;
      setIsAnalyzing(true);
      setProgress(null);
      setError(null);

      try {
        const response = await fetch(
          `/api/worlds/${encodeURIComponent(name)}/stats/analyze`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
        );
        if (!response.ok || !response.body) {
          throw new Error(`Analysis failed (HTTP ${response.status})`);
        }

        await consumeSseStream(response, (event, payload) => {
          if (event === 'progress') setProgress(payload as StatsAnalyzeProgress);
          else if (event === 'done') {
            // Seed the cache directly so the result shows even if the follow-up
            // refetch races the cache write.
            queryClient.setQueryData(['worlds', name, 'stats'], payload as BlockStatsResult);
          } else if (event === 'cancelled') setError('Analysis cancelled');
          else if (event === 'error') {
            setError((payload as { message?: string }).message ?? 'Analysis failed');
          }
        });

        await queryClient.invalidateQueries({ queryKey: ['worlds', name, 'stats'] });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Analysis failed');
      } finally {
        setIsAnalyzing(false);
        activeRef.current = false;
      }
    },
    [queryClient]
  );

  return { analyze, isAnalyzing, progress, error };
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
 * Hook to upload (import) a world from a .zip file.
 * Uses raw fetch instead of apiFetch because apiFetch forces Content-Type: application/json.
 */
export function useCreateWorldWithZip() {
  const queryClient = useQueryClient();

  return useMutation<CreateWorldResponse, Error & { statusCode?: number; code?: string }, { data: CreateWorldRequest; zipFile: File }>({
    mutationFn: async ({ data, zipFile }) => {
      const formData = new FormData();
      formData.append('worldZip', zipFile);

      const params = new URLSearchParams({ name: data.name });
      if (data.seed) params.set('seed', data.seed);

      const response = await fetch(`/api/worlds/upload?${params.toString()}`, {
        method: 'POST',
        body: formData,
        // No Content-Type header — browser sets the correct multipart boundary automatically
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'UnknownError',
          message: response.statusText,
        }));
        const error = new Error(errorData.message) as Error & { statusCode: number; code: string };
        error.statusCode = response.status;
        error.code = errorData.error;
        throw error;
      }

      return response.json() as Promise<CreateWorldResponse>;
    },
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
// Hostname Hooks
// ============================================================

/**
 * Hook to fetch server hostnames
 */
export function useServerHostnames(serverName: string, options?: { enabled?: boolean }) {
  return useQuery<HostnameResponse, Error>({
    queryKey: ['servers', serverName, 'hostnames'],
    queryFn: () =>
      apiFetch<HostnameResponse>(`/api/servers/${encodeURIComponent(serverName)}/hostnames`),
    enabled: options?.enabled !== false && !!serverName,
  });
}

/**
 * Hook to update custom hostnames
 */
export function useUpdateHostnames() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateHostnamesResponse,
    Error,
    { serverName: string; customHostnames: string[] }
  >({
    mutationFn: ({ serverName, customHostnames }) =>
      apiFetch<UpdateHostnamesResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/hostnames`,
        {
          method: 'PUT',
          body: JSON.stringify({ customHostnames }),
        }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'hostnames'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverName] });
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

// ============================================================
// Backup Schedule Hooks
// ============================================================

/**
 * Hook to fetch all backup schedules
 */
export function useBackupSchedules() {
  return useQuery<BackupScheduleListResponse, Error>({
    queryKey: ['backup-schedules'],
    queryFn: () => apiFetch<BackupScheduleListResponse>('/api/backup/schedules'),
    refetchInterval: 60000,
  });
}

/**
 * Hook to create a backup schedule
 */
export function useCreateBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation<BackupScheduleItem, Error, CreateBackupScheduleRequest>({
    mutationFn: (data) =>
      apiFetch<BackupScheduleItem>('/api/backup/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedules'] });
    },
  });
}

/**
 * Hook to update a backup schedule
 */
export function useUpdateBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation<
    BackupScheduleItem,
    Error,
    { id: string; data: UpdateBackupScheduleRequest }
  >({
    mutationFn: ({ id, data }) =>
      apiFetch<BackupScheduleItem>(`/api/backup/schedules/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedules'] });
    },
  });
}

/**
 * Hook to toggle a backup schedule
 */
export function useToggleBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation<
    BackupScheduleItem,
    Error,
    { id: string; enabled: boolean }
  >({
    mutationFn: ({ id, enabled }) =>
      apiFetch<BackupScheduleItem>(
        `/api/backup/schedules/${encodeURIComponent(id)}/toggle`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedules'] });
    },
  });
}

/**
 * Hook to delete a backup schedule
 */
export function useDeleteBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation<BackupScheduleActionResponse, Error, string>({
    mutationFn: (id) =>
      apiFetch<BackupScheduleActionResponse>(
        `/api/backup/schedules/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedules'] });
    },
  });
}

// ============================================================
// Whitelist Hooks
// ============================================================

/**
 * Hook to fetch whitelist for a server
 */
export function useWhitelist(serverName: string) {
  return useQuery<WhitelistResponse, Error>({
    queryKey: ['servers', serverName, 'whitelist'],
    queryFn: () =>
      apiFetch<WhitelistResponse>(`/api/players/whitelist?server=${encodeURIComponent(serverName)}`),
    enabled: !!serverName,
  });
}

/**
 * Hook to fetch whitelist enabled status
 */
export function useWhitelistStatus(serverName: string) {
  return useQuery<WhitelistStatusResponse, Error>({
    queryKey: ['servers', serverName, 'whitelist-status'],
    queryFn: () =>
      apiFetch<WhitelistStatusResponse>(`/api/players/whitelist/status?server=${encodeURIComponent(serverName)}`),
    enabled: !!serverName,
  });
}

/**
 * Hook to toggle whitelist enabled status
 */
export function useSetWhitelistStatus() {
  const queryClient = useQueryClient();

  return useMutation<WhitelistStatusResponse, Error, { serverName: string; enabled: boolean }>({
    mutationFn: ({ serverName, enabled }) =>
      apiFetch<WhitelistStatusResponse>('/api/players/whitelist/status', {
        method: 'PUT',
        body: JSON.stringify({ server: serverName, enabled }),
      }),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'whitelist-status'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'whitelist'] });
    },
  });
}

/**
 * Hook to add player to whitelist
 */
export function useAddToWhitelist() {
  const queryClient = useQueryClient();

  return useMutation<PlayerActionResponse, Error, { serverName: string; player: string }>({
    mutationFn: ({ serverName, player }) =>
      apiFetch<PlayerActionResponse>('/api/players/whitelist', {
        method: 'POST',
        body: JSON.stringify({ server: serverName, player }),
      }),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'whitelist'] });
    },
  });
}

/**
 * Hook to remove player from whitelist
 */
export function useRemoveFromWhitelist() {
  const queryClient = useQueryClient();

  return useMutation<PlayerActionResponse, Error, { serverName: string; player: string }>({
    mutationFn: ({ serverName, player }) =>
      apiFetch<PlayerActionResponse>(
        `/api/players/whitelist?player=${encodeURIComponent(player)}&server=${encodeURIComponent(serverName)}`,
        { method: 'DELETE' }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'whitelist'] });
    },
  });
}
