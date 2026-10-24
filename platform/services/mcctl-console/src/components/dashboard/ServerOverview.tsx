'use client';

import { Box, Typography, CircularProgress } from '@mui/material';
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

export function ServerOverview({
  servers,
  statusMap = {},
  isLoading,
  maxItems,
  showViewAll = false,
  onServerClick,
}: ServerOverviewProps) {
  const router = useAppRouter();

  const displayedServers = maxItems ? servers.slice(0, maxItems) : servers;

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
          showViewAll && servers.length > (maxItems || 0) ? (
            <NextLink
              href="/servers"
              onClick={() => startLoading()}
              style={{ textDecoration: 'none', color: 'inherit', fontSize: '0.875rem' }}
            >
              View All ({servers.length})
            </NextLink>
          ) : null
        }
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayedServers.map((server) => {
            // Use SSE status if available
            const sseStatus = statusMap[server.name];
            const currentStatus = sseStatus?.status || server.status;
            const currentHealth = sseStatus?.health || server.health;

            return (
              <ServerOverviewRow
                key={server.name}
                server={server}
                status={currentStatus}
                health={currentHealth}
                onClick={handleServerClick}
              />
            );
          })}
        </Box>
      </Box>
    </BentoPanel>
  );
}
