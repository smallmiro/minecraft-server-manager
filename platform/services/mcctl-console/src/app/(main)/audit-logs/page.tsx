'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import HistoryIcon from '@mui/icons-material/History';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { BentoGrid, BentoPanel, PageHero } from '@/components/bento';
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
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <PageHero
        compact
        title="Audit Log"
        description="Monitor all management activities across your servers"
        eyebrow="Operations"
        icon={<HistoryIcon />}
        status={
          <Chip
            aria-label="Audit stream status"
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
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                }}
              />
            }
            label={isConnected ? 'Live' : 'Disconnected'}
            color={isConnected ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        }
      />

      <BentoGrid aria-label="Audit log workspace">
        <BentoPanel
          role="region"
          aria-label="Audit log metrics"
          sx={{ gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' }, p: { xs: 1.5, sm: 2 } }}
        >
          <AuditLogStats stats={stats} isLoading={statsLoading} />
        </BentoPanel>

        <BentoPanel
          role="region"
          aria-label="Audit log controls"
          accent={newLogsCount > 0 ? 'primary' : 'neutral'}
          sx={{ gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' }, p: { xs: 2, sm: 2.5 } }}
        >
          {newLogsCount > 0 && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                textAlign: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                borderRadius: 2,
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

          <AuditLogFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onExport={() => setExportOpen(true)}
          />
        </BentoPanel>

        <BentoPanel
          role="region"
          aria-label="Audit log results"
          sx={{
            gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' },
            '& > .MuiPaper-root': { border: 0, boxShadow: 'none', borderRadius: 0 },
          }}
        >
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
        </BentoPanel>
      </BentoGrid>

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
    </Stack>
  );
}
