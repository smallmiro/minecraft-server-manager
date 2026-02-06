'use client';

import { Box, Grid, Typography, CircularProgress, Paper, alpha } from '@mui/material';
import {
  Storage as ServerIcon,
  CheckCircle as OnlineIcon,
  People as PlayersIcon,
  Public as WorldIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useServers, useWorlds } from '@/hooks/useMcctl';
import { useServersSSE } from '@/hooks/useServersSSE';
import { StatCard, ServerOverview, ChangelogFeed, RecentActivityFeed } from '@/components/dashboard';

export default function DashboardPage() {
  const { data: serversData, isLoading: serversLoading } = useServers();
  const { data: worldsData, isLoading: worldsLoading } = useWorlds();

  // Real-time server status updates
  const { statusMap } = useServersSSE();

  const isLoading = serversLoading || worldsLoading;

  // Calculate statistics with real-time status overlay
  const totalServers = serversData?.total || 0;

  // Count online servers using SSE status if available
  const onlineServers = serversData?.servers.filter(server => {
    const sseStatus = statusMap[server.name];
    const currentStatus = sseStatus?.status || server.status;
    return currentStatus === 'running';
  }).length || 0;

  const totalWorlds = worldsData?.total || 0;

  // TODO: Calculate total players from server details (requires player data)
  const totalPlayers = 0;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

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
            <DashboardIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Overview of your Minecraft server infrastructure
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Servers"
            value={totalServers}
            icon={<ServerIcon fontSize="large" />}
            color="primary"
            description="All configured servers"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Online Servers"
            value={onlineServers}
            icon={<OnlineIcon fontSize="large" />}
            color="success"
            description="Currently running"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Players"
            value={totalPlayers}
            icon={<PlayersIcon fontSize="large" />}
            color="info"
            description="Across all servers"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Worlds"
            value={totalWorlds}
            icon={<WorldIcon fontSize="large" />}
            color="secondary"
            description="Available worlds"
          />
        </Grid>
      </Grid>

      {/* Server Overview & Activity Feed */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <ServerOverview
            servers={serversData?.servers || []}
            statusMap={statusMap}
            isLoading={serversLoading}
            maxItems={5}
            showViewAll={true}
          />
        </Grid>
        <Grid item xs={12} lg={5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <RecentActivityFeed maxItems={5} />
            <ChangelogFeed maxVersions={2} />
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
