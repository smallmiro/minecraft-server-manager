'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { BentoGrid, BentoMetricCard, BentoPanel, PageHero } from '@/components/bento';
import { CreateServerDialog } from '@/components/servers/CreateServerDialog';
import { ServerList } from '@/components/servers/ServerList';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useCreateServerSSE } from '@/hooks/useCreateServerSSE';
import { useServersSSE } from '@/hooks/useServersSSE';
import { useServers, useStartServer, useStopServer } from '@/hooks/useMcctl';
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';

const metricItemSx = {
  gridColumn: { xs: '1 / -1', sm: 'span 2', md: 'span 4' },
  minWidth: 0,
} as const;

function MetricSkeleton() {
  return (
    <BentoPanel component="article" sx={{ minHeight: 152, p: 2.25 }}>
      <Skeleton variant="text" width="52%" />
      <Skeleton variant="text" width="30%" height={44} />
      <Skeleton variant="rounded" height={4} sx={{ mt: 1 }} />
      <Skeleton variant="text" width="64%" sx={{ mt: 0.75 }} />
    </BentoPanel>
  );
}

export default function ServersPage() {
  const router = useAppRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loadingServers, setLoadingServers] = useState<string[]>([]);

  const { data, isLoading, error } = useServers();
  const { statusMap, isConnected } = useServersSSE();
  const startServer = useStartServer();
  const stopServer = useStopServer();
  const createServer = useCreateServerSSE({
    onSuccess: () => {
      setCreateDialogOpen(false);
    },
    onError: (createError) => {
      console.error('Failed to create server:', createError);
    },
  });

  const servers = data?.servers ?? [];
  const serversUnavailable = !isLoading && (!data || Boolean(error));
  const liveStatusMap = isConnected ? statusMap : {};
  const totalServers = data?.total ?? servers.length;
  const runningServers = servers.filter((server) => {
    const currentStatus = liveStatusMap[server.name]?.status ?? server.status;
    return currentStatus === 'running';
  }).length;
  const attentionServers = servers.filter((server) => {
    const currentStatus = liveStatusMap[server.name]?.status ?? server.status;
    const currentHealth = liveStatusMap[server.name]?.health ?? server.health;
    return currentStatus !== 'running' || currentHealth === 'unhealthy';
  }).length;
  const runningPercent = totalServers > 0 ? Math.round((runningServers / totalServers) * 100) : 0;

  const handleServerClick = (serverName: string) => {
    router.push(`/servers/${encodeURIComponent(serverName)}`);
  };

  const handleCreateServer = (request: CreateServerRequest) => {
    createServer.createServer(request);
  };

  const handleStartServer = async (serverName: string) => {
    setLoadingServers((current) => [...current, serverName]);
    try {
      await startServer.mutateAsync(serverName);
    } catch (startError) {
      console.error('Failed to start server:', startError);
    } finally {
      setLoadingServers((current) => current.filter((name) => name !== serverName));
    }
  };

  const handleStopServer = async (serverName: string) => {
    setLoadingServers((current) => [...current, serverName]);
    try {
      await stopServer.mutateAsync(serverName);
    } catch (stopError) {
      console.error('Failed to stop server:', stopError);
    } finally {
      setLoadingServers((current) => current.filter((name) => name !== serverName));
    }
  };

  return (
    <>
      <BentoGrid aria-label="Server management">
        <PageHero
          compact
          aria-label="Servers overview"
          aria-busy={isLoading ? 'true' : undefined}
          title="Servers"
          eyebrow="Operations"
          description="Manage your Minecraft servers"
          icon={<StorageIcon />}
          status={
            <Chip
              size="small"
              color={isConnected ? 'success' : 'default'}
              label={isConnected ? 'Live' : 'Reconnecting'}
            />
          }
          actions={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Create Server
            </Button>
          }
          sx={{ gridColumn: '1 / -1' }}
        />

        {error && (
          <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
            Failed to load servers: {error.message}
          </Alert>
        )}
        {createServer.error && (
          <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
            Failed to create server: {createServer.error}
          </Alert>
        )}
        {startServer.isError && (
          <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
            Failed to start server: {startServer.error?.message}
          </Alert>
        )}
        {stopServer.isError && (
          <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
            Failed to stop server: {stopServer.error?.message}
          </Alert>
        )}

        {isLoading ? (
          [0, 1, 2].map((item) => (
            <Box key={item} sx={metricItemSx}>
              <MetricSkeleton />
            </Box>
          ))
        ) : (
          <>
            <Box sx={metricItemSx}>
              <BentoMetricCard
                title="Total servers"
                value={serversUnavailable ? 'Unavailable' : totalServers}
                icon={<StorageIcon fontSize="small" />}
                description={serversUnavailable ? 'Server data unavailable' : `${runningServers} currently running`}
              />
            </Box>
            <Box sx={metricItemSx}>
              <BentoMetricCard
                title="Running servers"
                value={serversUnavailable ? 'Unavailable' : runningServers}
                unit={!serversUnavailable && totalServers > 0 ? `/ ${totalServers}` : undefined}
                icon={<CheckCircleIcon fontSize="small" />}
                accent="success"
                progress={!serversUnavailable && totalServers > 0 ? runningPercent : undefined}
                description={serversUnavailable ? 'Server data unavailable' : `${runningPercent}% available`}
              />
            </Box>
            <Box sx={metricItemSx}>
              <BentoMetricCard
                title="Needs attention"
                value={serversUnavailable ? 'Unavailable' : attentionServers}
                icon={<WarningAmberIcon fontSize="small" />}
                accent={serversUnavailable || attentionServers > 0 ? 'warning' : 'success'}
                description={serversUnavailable ? 'Server data unavailable' : attentionServers > 0 ? 'Stopped or unhealthy' : 'All systems operational'}
              />
            </Box>
          </>
        )}

        <BentoPanel
          aria-label="Server inventory"
          sx={{ gridColumn: '1 / -1', p: { xs: 2, sm: 3 } }}
        >
          {isLoading ? (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Skeleton variant="rounded" width="100%" height={40} />
              <Skeleton variant="rounded" width="100%" height={180} />
            </Box>
          ) : serversUnavailable ? (
            <Typography color="text.secondary">Server inventory unavailable</Typography>
          ) : (
            <ServerList
              servers={servers}
              statusMap={liveStatusMap}
              onServerClick={handleServerClick}
              onStart={handleStartServer}
              onStop={handleStopServer}
              onCreate={() => setCreateDialogOpen(true)}
              loadingServers={loadingServers}
            />
          )}
        </BentoPanel>
      </BentoGrid>

      <CreateServerDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          createServer.reset();
        }}
        onSubmit={handleCreateServer}
        loading={createServer.isCreating}
        status={createServer.status}
        progress={createServer.progress}
        message={createServer.message}
      />
    </>
  );
}
