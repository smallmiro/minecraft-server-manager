'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serverApi, ApiError } from '@/lib/api';
import type { ServersResponse, ServerDetail, ServerSummary, ServerActionResponse } from '@/types/server';

// Query keys for cache management
export const serverKeys = {
  all: ['servers'] as const,
  lists: () => [...serverKeys.all, 'list'] as const,
  list: () => [...serverKeys.lists()] as const,
  details: () => [...serverKeys.all, 'detail'] as const,
  detail: (name: string) => [...serverKeys.details(), name] as const,
  logs: (name: string) => [...serverKeys.all, 'logs', name] as const,
};

/**
 * Hook to fetch all servers
 */
export function useServers() {
  return useQuery<ServersResponse, ApiError>({
    queryKey: serverKeys.list(),
    queryFn: () => serverApi.getServers(),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch a single server's details
 */
export function useServer(name: string) {
  return useQuery<ServerDetail, ApiError>({
    queryKey: serverKeys.detail(name),
    queryFn: () => serverApi.getServer(name),
    enabled: !!name,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000, // More frequent updates for detail view
  });
}

/**
 * Hook to fetch server logs
 */
export function useServerLogs(name: string, lines: number = 50) {
  return useQuery({
    queryKey: serverKeys.logs(name),
    queryFn: () => serverApi.getLogs(name, lines),
    enabled: !!name,
    staleTime: 2 * 1000, // Logs change frequently
    refetchInterval: 5 * 1000,
  });
}

/**
 * Hook for starting a server
 */
export function useStartServer() {
  const queryClient = useQueryClient();

  return useMutation<ServerActionResponse, ApiError, string>({
    mutationFn: (name: string) => serverApi.startServer(name),
    onSuccess: (_data: ServerActionResponse, name: string) => {
      // Invalidate server queries to refresh status
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(name) });
    },
  });
}

/**
 * Hook for stopping a server
 */
export function useStopServer() {
  const queryClient = useQueryClient();

  return useMutation<ServerActionResponse, ApiError, string>({
    mutationFn: (name: string) => serverApi.stopServer(name),
    onSuccess: (_data: ServerActionResponse, name: string) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(name) });
    },
  });
}

/**
 * Hook for restarting a server
 */
export function useRestartServer() {
  const queryClient = useQueryClient();

  return useMutation<ServerActionResponse, ApiError, string>({
    mutationFn: (name: string) => serverApi.restartServer(name),
    onSuccess: (_data: ServerActionResponse, name: string) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(name) });
    },
  });
}

/**
 * Get status badge color based on server status
 */
export function getStatusColor(status: ServerSummary['status']): string {
  switch (status) {
    case 'running':
      return 'bg-green-500';
    case 'stopped':
      return 'bg-gray-500';
    case 'starting':
      return 'bg-yellow-500';
    case 'stopping':
      return 'bg-orange-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

/**
 * Get health badge color based on health status
 */
export function getHealthColor(health: ServerSummary['health']): string {
  switch (health) {
    case 'healthy':
      return 'text-green-600';
    case 'unhealthy':
      return 'text-red-600';
    case 'unknown':
    default:
      return 'text-gray-500';
  }
}
