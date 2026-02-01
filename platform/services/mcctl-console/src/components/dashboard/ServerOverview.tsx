'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  CircularProgress,
  Chip,
  Link,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';

export interface ServerOverviewProps {
  servers: ServerSummary[];
  isLoading: boolean;
  maxItems?: number;
  showViewAll?: boolean;
  onServerClick?: (serverName: string) => void;
}

export function ServerOverview({
  servers,
  isLoading,
  maxItems,
  showViewAll = false,
  onServerClick,
}: ServerOverviewProps) {
  const router = useRouter();

  const displayedServers = maxItems ? servers.slice(0, maxItems) : servers;

  const handleServerClick = (serverName: string) => {
    if (onServerClick) {
      onServerClick(serverName);
    } else {
      router.push(`/servers/${serverName}`);
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'default' | 'warning' => {
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
  };

  const getHealthColor = (health: string): 'success' | 'error' | 'warning' | 'default' => {
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
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Servers" />
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (servers.length === 0) {
    return (
      <Card>
        <CardHeader title="Servers" />
        <CardContent>
          <Typography color="text.secondary" align="center">
            No servers found. Create your first server to get started.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Servers"
        action={
          showViewAll && servers.length > (maxItems || 0) ? (
            <Link
              href="/servers"
              color="primary"
              sx={{ textDecoration: 'none', fontSize: '0.875rem' }}
            >
              View All ({servers.length})
            </Link>
          ) : null
        }
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayedServers.map((server) => (
            <Box
              key={server.name}
              role="button"
              onClick={() => handleServerClick(server.name)}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {server.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {server.hostname}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={server.status}
                    color={getStatusColor(server.status)}
                    size="small"
                  />
                  {server.health !== 'none' && (
                    <Chip
                      label={server.health}
                      color={getHealthColor(server.health)}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
