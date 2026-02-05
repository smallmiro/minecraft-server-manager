'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import {
  AuditLogStats,
  AuditLogFilters,
  AuditLogTable,
  AuditLogDetail,
  AuditLogExport,
} from '@/components/audit-logs';
import { useAuditLogs, useAuditLogStats } from '@/hooks/useAuditLogs';
import { useSSE } from '@/hooks/useSSE';
import type { AuditLogEntry, AuditLogQueryParams } from '@/types/audit-log';
import type { AuditLogEvent, SSEEvent } from '@/types/events';

/**
 * Parse URL search params to AuditLogQueryParams
 */
function parseSearchParams(searchParams: URLSearchParams): AuditLogQueryParams {
  const params: AuditLogQueryParams = {};

  const action = searchParams.get('action');
  const actor = searchParams.get('actor');
  const targetType = searchParams.get('targetType');
  const targetName = searchParams.get('targetName');
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');
  const sort = searchParams.get('sort');

  if (action) params.action = action;
  if (actor) params.actor = actor;
  if (targetType) params.targetType = targetType;
  if (targetName) params.targetName = targetName;
  if (status) params.status = status;
  if (from) params.from = from;
  if (to) params.to = to;
  if (limit) params.limit = parseInt(limit, 10);
  if (offset) params.offset = parseInt(offset, 10);
  if (sort === 'timestamp:asc' || sort === 'timestamp:desc') params.sort = sort;

  return params;
}

/**
 * Convert AuditLogQueryParams to URL search params
 */
function toSearchParams(params: AuditLogQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.action) searchParams.set('action', params.action);
  if (params.actor) searchParams.set('actor', params.actor);
  if (params.targetType) searchParams.set('targetType', params.targetType);
  if (params.targetName) searchParams.set('targetName', params.targetName);
  if (params.status) searchParams.set('status', params.status);
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.limit && params.limit !== 50) searchParams.set('limit', String(params.limit));
  if (params.offset && params.offset > 0) searchParams.set('offset', String(params.offset));
  if (params.sort && params.sort !== 'timestamp:desc') searchParams.set('sort', params.sort);

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Audit Log page component
 */
export default function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse initial filters from URL
  const [filters, setFilters] = useState<AuditLogQueryParams>(() =>
    parseSearchParams(searchParams)
  );

  // Detail drawer state
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);

  // SSE new logs tracking
  const [newLogsCount, setNewLogsCount] = useState(0);
  const seenIdsRef = useRef(new Set<string>());

  // Fetch data
  const { data, isLoading, error, refetch } = useAuditLogs(filters);
  const { data: stats, isLoading: statsLoading } = useAuditLogStats();

  // SSE for real-time updates
  const { isConnected } = useSSE<AuditLogEvent>({
    url: '/api/audit-logs/stream',
    enabled: true,
    onMessage: useCallback((event: SSEEvent) => {
      if (event.type === 'audit-log') {
        const logData = event.data;
        // Duplicate prevention
        if ('id' in logData && typeof logData.id === 'string') {
          if (seenIdsRef.current.has(logData.id)) return;
          seenIdsRef.current.add(logData.id);

          // Trim seen IDs set if too large
          if (seenIdsRef.current.size > 1000) {
            const idsArray = Array.from(seenIdsRef.current);
            seenIdsRef.current = new Set(idsArray.slice(idsArray.length - 500));
          }
        }

        setNewLogsCount((prev) => prev + 1);
      }
    }, []),
    reconnectInterval: 3000,
    maxReconnectAttempts: Infinity,
  });

  // Sync filters to URL
  useEffect(() => {
    const newSearch = toSearchParams(filters);
    const currentSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
    if (newSearch !== currentSearch) {
      router.replace(`/audit-logs${newSearch}`, { scroll: false });
    }
  }, [filters, router, searchParams]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: AuditLogQueryParams) => {
    setFilters(newFilters);
    setNewLogsCount(0);
  }, []);

  // Handle row click (open detail drawer)
  const handleRowClick = useCallback((log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailOpen(true);
  }, []);

  // Handle refresh (includes new SSE logs)
  const handleRefresh = useCallback(() => {
    setNewLogsCount(0);
    refetch();
  }, [refetch]);

  return (
    <>
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <HistoryIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h4" component="h1" fontWeight="bold">
                Audit Log
              </Typography>
              {/* Live indicator */}
              <Chip
                icon={
                  <FiberManualRecordIcon
                    sx={{
                      fontSize: 10,
                      color: isConnected ? 'success.main' : 'text.disabled',
                      animation: isConnected ? 'pulse 2s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                        '100%': { opacity: 1 },
                      },
                    }}
                  />
                }
                label={isConnected ? 'Live' : 'Offline'}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            </Box>
            <Typography variant="body1" color="text.secondary">
              Monitor all management activities across your servers
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Stats Cards */}
      <Box sx={{ mb: 3 }}>
        <AuditLogStats stats={stats} isLoading={statsLoading} />
      </Box>

      {/* New logs banner */}
      {newLogsCount > 0 && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            textAlign: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': { opacity: 0.9 },
          }}
          onClick={handleRefresh}
          role="button"
          aria-label={`${newLogsCount} new logs, click to refresh`}
        >
          <Typography variant="body2" fontWeight={600}>
            {newLogsCount} new {newLogsCount === 1 ? 'log' : 'logs'} available - Click to refresh
          </Typography>
        </Box>
      )}

      {/* Filters */}
      <AuditLogFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onExport={() => setExportOpen(true)}
      />

      {/* Log Table */}
      <AuditLogTable
        logs={data?.logs ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        error={error}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRowClick={handleRowClick}
        onRetry={() => refetch()}
      />

      {/* Detail Drawer */}
      <AuditLogDetail
        log={selectedLog}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLog(null);
        }}
      />

      {/* Export Dialog */}
      <AuditLogExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={filters}
        totalCount={data?.total ?? 0}
      />
    </>
  );
}
