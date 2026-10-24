'use client';

import { Box, Chip, Typography } from '@mui/material';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import { HostnameDisplay } from '@/components/common';

export interface ServerOverviewRowProps {
  server: ServerSummary;
  status: string;
  health: string;
  onClick: (serverName: string) => void;
}

function getStatusColor(status: string): 'success' | 'error' | 'default' | 'warning' {
  switch (status) {
    case 'running':
      return 'success';
    case 'stopped':
    case 'exited':
      return 'error';
    case 'created':
      return 'warning';
    default:
      return 'default';
  }
}

function getHealthColor(health: string): 'success' | 'error' | 'warning' | 'default' {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'unhealthy':
      return 'error';
    case 'starting':
      return 'warning';
    default:
      return 'default';
  }
}

export function ServerOverviewRow({ server, status, health, onClick }: ServerOverviewRowProps) {
  return (
    <Box
      role="button"
      onClick={() => onClick(server.name)}
      sx={{
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {server.name}
          </Typography>
          <HostnameDisplay hostname={server.hostname} fontSize={12} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Chip label={status} color={getStatusColor(status)} size="small" />
          {health !== 'none' && (
            <Chip label={health} color={getHealthColor(health)} size="small" variant="outlined" />
          )}
        </Box>
      </Box>
    </Box>
  );
}
