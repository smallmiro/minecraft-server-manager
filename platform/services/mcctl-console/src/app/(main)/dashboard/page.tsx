'use client';

import { Box, Typography, Skeleton, Card, CardContent, Paper, alpha } from '@mui/material';
import {
  Storage as ServerIcon,
  CheckCircle as OnlineIcon,
  People as PlayersIcon,
  Public as WorldIcon,
} from '@mui/icons-material';
import { useServers, useWorlds } from '@/hooks/useMcctl';
import { useServersSSE } from '@/hooks/useServersSSE';
import {
  DashboardHero,
  StatCard,
  ServerOverview,
  ChangelogFeed,
  RecentActivityFeed,
  PlayitSummaryCard,
} from '@/components/dashboard';

const bentoGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    sm: 'repeat(6, minmax(0, 1fr))',
    md: 'repeat(12, minmax(0, 1fr))',
  },
  gap: { xs: 2, sm: 2.5 },
  alignItems: 'stretch',
} as const;

const metricItemSx = {
  gridColumn: { xs: '1 / -1', sm: 'span 3', md: 'span 3' },
  minWidth: 0,
} as const;

const cardItemSx = {
  minWidth: 0,
  '& > .MuiCard-root': {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
} as const;

function SkeletonMetricCard() {
  return (
    <Card sx={{ height: '100%', minHeight: 152, borderRadius: 4 }}>
      <CardContent sx={{ p: 2.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: 2 }} />
        </Box>
        <Skeleton variant="text" width="30%" height={38} />
        <Skeleton variant="rounded" width="100%" height={4} sx={{ mt: 1 }} />
        <Skeleton variant="text" width="68%" sx={{ mt: 0.75 }} />
      </CardContent>
    </Card>
  );
}

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

  // Derived metrics for the compact stat cards (computed values only — no history)
  const stoppedServers = totalServers - onlineServers;
  const onlinePercent = totalServers > 0 ? Math.round((onlineServers / totalServers) * 100) : 0;
  const assignedWorlds = worldsData?.worlds.filter((world) => world.isLocked).length || 0;
  const freeWorlds = totalWorlds - assignedWorlds;

  if (isLoading) {
    return (
      <Box component="section" aria-label="Dashboard overview" aria-busy="true" sx={bentoGridSx}>
        <Paper
          elevation={0}
          sx={{
            gridColumn: { xs: '1 / -1', md: 'span 6' },
            gridRow: { md: 'span 2' },
            minHeight: { xs: 280, md: 328 },
            p: { xs: 3, sm: 4 },
            background: (theme) =>
              `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 52%, ${theme.palette.background.paper} 100%)`,
            borderRadius: 4,
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Skeleton variant="rounded" width={42} height={42} sx={{ borderRadius: 2.5 }} />
            <Skeleton variant="text" width={120} />
          </Box>
          <Typography variant="h4" component="h1" fontWeight="bold" sx={{ mt: 3 }}>
            Dashboard
          </Typography>
          <Skeleton variant="text" width="72%" />
          <Box sx={{ mt: 7 }}>
            <Skeleton variant="text" width="45%" height={48} />
            <Skeleton variant="rounded" width="100%" height={7} sx={{ mt: 1 }} />
          </Box>
        </Paper>

        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={metricItemSx}>
            <SkeletonMetricCard />
          </Box>
        ))}

        <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 8' }, minHeight: 390 }}>
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
        </Box>

        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              ...cardItemSx,
              gridColumn: {
                xs: '1 / -1',
                md: i === 0 ? 'span 4' : i === 1 ? 'span 7' : 'span 5',
              },
              minHeight: i === 0 ? 210 : 300,
            }}
          >
            <Card>
              <CardContent>
                <Skeleton variant="text" width="42%" height={32} sx={{ mb: 2 }} />
                {[0, 1, 2].map((row) => (
                  <Box key={row} sx={{ display: 'flex', gap: 1.5, py: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="82%" />
                      <Skeleton variant="text" width="54%" />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Dashboard overview" sx={bentoGridSx}>
      <DashboardHero
        totalServers={totalServers}
        onlineServers={onlineServers}
        stoppedServers={stoppedServers}
        onlinePercent={onlinePercent}
      />

      <Box sx={metricItemSx}>
          <StatCard
            title="Total Servers"
            value={totalServers}
            icon={<ServerIcon fontSize="small" />}
            color="primary"
            progress={totalServers > 0 ? (onlineServers / totalServers) * 100 : undefined}
            description={`${onlineServers} running · ${stoppedServers} stopped`}
          />
      </Box>
      <Box sx={metricItemSx}>
          <StatCard
            title="Online Servers"
            value={onlineServers}
            unit={totalServers > 0 ? `/ ${totalServers}` : undefined}
            icon={<OnlineIcon fontSize="small" />}
            color="success"
            progress={totalServers > 0 ? onlinePercent : undefined}
            description={`${onlinePercent}% running`}
          />
      </Box>
      <Box sx={metricItemSx}>
          <StatCard
            title="Total Players"
            value={totalPlayers}
            icon={<PlayersIcon fontSize="small" />}
            color="info"
            description="Across all servers"
          />
      </Box>
      <Box sx={metricItemSx}>
          <StatCard
            title="Total Worlds"
            value={totalWorlds}
            icon={<WorldIcon fontSize="small" />}
            color="secondary"
            progress={totalWorlds > 0 ? (assignedWorlds / totalWorlds) * 100 : undefined}
            description={`${assignedWorlds} assigned · ${freeWorlds} free`}
          />
      </Box>

      <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 8' } }}>
          <ServerOverview
            servers={serversData?.servers || []}
            statusMap={statusMap}
            isLoading={serversLoading}
            maxItems={5}
            showViewAll={true}
          />
      </Box>
      <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 4' } }}>
        <PlayitSummaryCard />
      </Box>
      <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 7' } }}>
        <RecentActivityFeed maxItems={5} />
      </Box>
      <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 5' } }}>
        <ChangelogFeed maxVersions={2} />
      </Box>
    </Box>
  );
}
