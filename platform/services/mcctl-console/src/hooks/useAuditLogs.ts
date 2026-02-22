'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  AuditLogListResponse,
  AuditLogStatsResponse,
  AuditLogDetailResponse,
  AuditLogPurgeRequest,
  AuditLogPurgeResponse,
  AuditLogQueryParams,
} from '@/types/audit-log';

/**
 * Build query string from AuditLogQueryParams
 */
function buildQueryString(params: AuditLogQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.action) searchParams.set('action', params.action);
  if (params.actor) searchParams.set('actor', params.actor);
  if (params.targetType) searchParams.set('targetType', params.targetType);
  if (params.targetName) searchParams.set('targetName', params.targetName);
  if (params.status) searchParams.set('status', params.status);
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params.sort) searchParams.set('sort', params.sort);

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Hook to fetch audit logs list with filtering and pagination
 */
export function useAuditLogs(params: AuditLogQueryParams = {}, options?: { enabled?: boolean }) {
  const queryString = buildQueryString(params);

  return useQuery<AuditLogListResponse, Error>({
    queryKey: ['audit-logs', params],
    queryFn: () => apiFetch<AuditLogListResponse>(`/api/audit-logs${queryString}`),
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to fetch audit log statistics
 */
export function useAuditLogStats(options?: { enabled?: boolean }) {
  return useQuery<AuditLogStatsResponse, Error>({
    queryKey: ['audit-logs', 'stats'],
    queryFn: () => apiFetch<AuditLogStatsResponse>('/api/audit-logs/stats'),
    enabled: options?.enabled !== false,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to fetch a single audit log entry with related logs
 */
export function useAuditLogDetail(id: string | null, options?: { enabled?: boolean }) {
  return useQuery<AuditLogDetailResponse, Error>({
    queryKey: ['audit-logs', id],
    queryFn: () => apiFetch<AuditLogDetailResponse>(`/api/audit-logs/${encodeURIComponent(id!)}`),
    enabled: options?.enabled !== false && !!id,
  });
}

/**
 * Hook to purge old audit logs
 */
export function usePurgeAuditLogs() {
  const queryClient = useQueryClient();

  return useMutation<AuditLogPurgeResponse, Error, AuditLogPurgeRequest>({
    mutationFn: (data) =>
      apiFetch<AuditLogPurgeResponse>('/api/audit-logs', {
        method: 'DELETE',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

/**
 * Hook to fetch recent audit logs for a specific server
 * Supports optional filtering and pagination via extraParams
 */
export function useServerAuditLogs(
  serverName: string,
  options?: {
    enabled?: boolean;
    limit?: number;
    extraParams?: Partial<AuditLogQueryParams>;
  },
) {
  const params: AuditLogQueryParams = {
    targetType: 'server',
    targetName: serverName,
    limit: options?.limit ?? 20,
    ...options?.extraParams,
  };

  return useAuditLogs(params, { enabled: options?.enabled !== false && !!serverName });
}

/**
 * Hook to fetch recent activity for dashboard
 */
export function useRecentActivity(limit: number = 10) {
  return useAuditLogs({ limit, sort: 'timestamp:desc' });
}
