'use client';

import { Box, Grid, Typography, Skeleton, Card, CardContent, Paper, alpha } from '@mui/material';
import {
  Storage as ServerIcon,
  CheckCircle as OnlineIcon,
  People as PlayersIcon,
  Public as WorldIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useServers, useWorlds } from '@/hooks/useMcctl';
import { useServersSSE } from '@/hooks/useServersSSE';
import { StatCard, ServerOverview, ChangelogFeed, RecentActivityFeed, PlayitSummaryCard } from '@/components/dashboard';

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
      <>
        {/* Page Header */}
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: 3,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
            borderRadius: 2,
            border: (theme) => `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
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
              <Typography variant="h4" component="h1" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Overview of your Minecraft server infrastructure
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Skeleton Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'grey.300' } }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="circular" width={32} height={32} />
                  </Box>
                  <Skeleton variant="text" width="40%" height={48} />
                  <Skeleton variant="text" width="70%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Skeleton Server Overview & Activity */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
                {[0, 1, 2, 3, 4].map((i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Skeleton variant="circular" width={10} height={10} />
                    <Skeleton variant="text" width="25%" />
                    <Skeleton variant="rounded" width={60} height={24} sx={{ ml: 'auto' }} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
                  {[0, 1, 2, 3].map((i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="50%" />
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="35%" height={32} sx={{ mb: 2 }} />
                  {[0, 1].map((i) => (
                    <Box key={i} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="90%" />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Box>
          </Grid>
        </Grid>
      </>
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
            `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'secondary.main',
              color: 'secondary.contrastText',
            }}
          >
            <DashboardIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
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
        <Grid item xs={12} md={7}>
          <ServerOverview
            servers={serversData?.servers || []}
            statusMap={statusMap}
            isLoading={serversLoading}
            maxItems={5}
            showViewAll={true}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <PlayitSummaryCard />
            <RecentActivityFeed maxItems={5} />
            <ChangelogFeed maxVersions={2} />
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
