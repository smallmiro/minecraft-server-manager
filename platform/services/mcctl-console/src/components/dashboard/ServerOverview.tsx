'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import NextLink from 'next/link';
import { startLoading } from '@/components/providers';
import { useAppRouter } from '@/hooks/useAppRouter';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import type { ServerStatusMap } from '@/hooks/useServersSSE';
import { ServerOverviewRow } from './ServerOverviewRow';
import { BentoPanel, BentoPanelHeader } from '@/components/bento';

export interface ServerOverviewProps {
  servers: ServerSummary[];
  statusMap?: ServerStatusMap;
  isLoading: boolean;
  maxItems?: number;
  showViewAll?: boolean;
  onServerClick?: (serverName: string) => void;
}

type StatusFilter = 'all' | 'running' | 'stopped';

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  running: 'Running',
  stopped: 'Stopped',
};

export function ServerOverview({
  servers,
  statusMap = {},
  isLoading,
  maxItems,
  showViewAll = false,
  onServerClick,
}: ServerOverviewProps) {
  const router = useAppRouter();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Overlay live SSE status on top of the fetched snapshot
  const resolved = servers.map((server) => {
    const sseStatus = statusMap[server.name];
    return {
      server,
      status: sseStatus?.status || server.status,
      health: sseStatus?.health || server.health,
    };
  });
  const runningCount = resolved.filter((item) => item.status === 'running').length;
  const counts: Record<StatusFilter, number> = {
    all: resolved.length,
    running: runningCount,
    stopped: resolved.length - runningCount,
  };
  const filtered = resolved.filter((item) => {
    if (filter === 'running') return item.status === 'running';
    if (filter === 'stopped') return item.status !== 'running';
    return true;
  });
  const displayedServers = maxItems ? filtered.slice(0, maxItems) : filtered;

  const handleServerClick = (serverName: string) => {
    if (onServerClick) {
      onServerClick(serverName);
    } else {
      router.push(`/servers/${serverName}`);
    }
  };

  if (isLoading) {
    return (
      <BentoPanel sx={{ height: '100%' }}>
        <BentoPanelHeader title="Servers" />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Box>
      </BentoPanel>
    );
  }

  if (servers.length === 0) {
    return (
      <BentoPanel sx={{ height: '100%' }}>
        <BentoPanelHeader title="Servers" />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Typography color="text.secondary" align="center">
            No servers found. Create your first server to get started.
          </Typography>
        </Box>
      </BentoPanel>
    );
  }

  return (
    <BentoPanel sx={{ height: '100%' }}>
      <BentoPanelHeader
        title="Servers"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1.5 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filter}
              onChange={(_, next: StatusFilter | null) => {
                if (next) setFilter(next);
              }}
              aria-label="Filter servers by status"
            >
              {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((key) => (
                <ToggleButton key={key} value={key} sx={{ px: 1.25, py: 0.25, textTransform: 'none' }}>
                  {FILTER_LABELS[key]} {counts[key]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {showViewAll && servers.length > (maxItems || 0) && (
              <NextLink
                href="/servers"
                onClick={() => startLoading()}
                style={{ textDecoration: 'none', color: 'inherit', fontSize: '0.875rem' }}
              >
                View All ({servers.length})
              </NextLink>
            )}
          </Box>
        }
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        {displayedServers.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
            No {filter} servers
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {displayedServers.map(({ server, status, health }) => (
              <ServerOverviewRow
                key={server.name}
                server={server}
                status={status}
                health={health}
                onClick={handleServerClick}
                onActionError={setActionError}
              />
            ))}
          </Box>
        )}
      </Box>
      <Snackbar
        open={actionError !== null}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setActionError(null)} severity="error" sx={{ width: '100%' }}>
          {actionError}
        </Alert>
      </Snackbar>
    </BentoPanel>
  );
}
