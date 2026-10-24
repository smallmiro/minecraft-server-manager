'use client';

import { Alert, Box, Skeleton, Typography } from '@mui/material';
import {
  Storage as ServerIcon,
  CheckCircle as OnlineIcon,
  People as PlayersIcon,
  Public as WorldIcon,
} from '@mui/icons-material';
import { useServers, useWorlds } from '@/hooks/useMcctl';
import { useServersSSE } from '@/hooks/useServersSSE';
import { BentoGrid, BentoMetricCard, BentoPanel, BentoPanelHeader, PageHero } from '@/components/bento';
import {
  DashboardHero,
  ServerOverview,
  ChangelogFeed,
  RecentActivityFeed,
  PlayitSummaryCard,
} from '@/components/dashboard';

const metricItemSx = {
  gridColumn: { xs: '1 / -1', sm: 'span 3', md: 'span 3' },
  minWidth: 0,
} as const;

const cardItemSx = {
  minWidth: 0,
} as const;

function SkeletonMetricCard() {
  return (
    <BentoPanel sx={{ height: '100%', minHeight: 152 }}>
      <Box sx={{ p: 2.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: 2 }} />
        </Box>
        <Skeleton variant="text" width="30%" height={38} />
        <Skeleton variant="rounded" width="100%" height={4} sx={{ mt: 1 }} />
        <Skeleton variant="text" width="68%" sx={{ mt: 0.75 }} />
      </Box>
    </BentoPanel>
  );
}

export default function DashboardPage() {
  const { data: serversData, isLoading: serversLoading, error: serversError } = useServers();
  const { data: worldsData, isLoading: worldsLoading, error: worldsError } = useWorlds();

  // Real-time server status updates
  const { statusMap, isConnected } = useServersSSE();

  const isLoading = serversLoading || worldsLoading;
  const serversUnavailable = !serversLoading && !serversData;
  const worldsUnavailable = !worldsLoading && !worldsData;
  const liveStatusMap = isConnected ? statusMap : {};

  // Calculate statistics with real-time status overlay
  const totalServers = serversData?.total || 0;

  // Count online servers using SSE status if available
  const onlineServers = serversData?.servers.filter(server => {
    const sseStatus = liveStatusMap[server.name];
    const currentStatus = sseStatus?.status || server.status;
    return currentStatus === 'running';
  }).length || 0;

  const totalWorlds = worldsData?.total || 0;

  // Player counts are not exposed by the list endpoint yet (see #764). Keep null so the
  // card renders "—" instead of a misleading 0; #764 only has to supply a number here.
  const totalPlayers: number | null = null;

  // Derived metrics for the compact stat cards (computed values only — no history)
  const stoppedServers = totalServers - onlineServers;
  const attentionServers = serversData?.servers.filter((server) => {
    const sseStatus = liveStatusMap[server.name];
    const currentStatus = sseStatus?.status || server.status;
    const currentHealth = sseStatus?.health || server.health;
    return currentStatus !== 'running' || currentHealth === 'unhealthy';
  }).length || 0;
  const onlinePercent = totalServers > 0 ? Math.round((onlineServers / totalServers) * 100) : 0;
  const assignedWorlds = worldsData?.worlds.filter((world) => world.isLocked).length || 0;
  const freeWorlds = totalWorlds - assignedWorlds;

  if (isLoading) {
    return (
      <BentoGrid aria-label="Dashboard overview" aria-busy="true">
        <PageHero
          eyebrow={<Skeleton variant="text" width={120} />}
          icon={<Skeleton variant="rounded" width={42} height={42} sx={{ borderRadius: 2.5 }} />}
          title="Dashboard"
          description={<Skeleton variant="text" width="72%" />}
          status={<Skeleton variant="rounded" width={72} height={24} sx={{ borderRadius: 4 }} />}
          sx={{
            gridColumn: { xs: '1 / -1', md: 'span 6' },
            gridRow: { md: 'span 2' },
            minHeight: { xs: 280, md: 328 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <Skeleton variant="text" width="45%" height={48} />
          <Skeleton variant="rounded" width="100%" height={7} sx={{ mt: 1 }} />
        </PageHero>

        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={metricItemSx}>
            <SkeletonMetricCard />
          </Box>
        ))}

        <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 8' }, minHeight: 390 }}>
            <BentoPanel sx={{ height: '100%' }}>
              <BentoPanelHeader title={<Skeleton variant="text" width="30%" />} />
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Skeleton variant="circular" width={10} height={10} />
                    <Skeleton variant="text" width="25%" />
                    <Skeleton variant="rounded" width={60} height={24} sx={{ ml: 'auto' }} />
                  </Box>
                ))}
              </Box>
            </BentoPanel>
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
            <BentoPanel sx={{ height: '100%' }}>
              <BentoPanelHeader title={<Skeleton variant="text" width="42%" />} />
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                {[0, 1, 2].map((row) => (
                  <Box key={row} sx={{ display: 'flex', gap: 1.5, py: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="82%" />
                      <Skeleton variant="text" width="54%" />
                    </Box>
                  </Box>
                ))}
              </Box>
            </BentoPanel>
          </Box>
        ))}
      </BentoGrid>
    );
  }

  return (
    <BentoGrid aria-label="Dashboard overview">
      <DashboardHero
        totalServers={totalServers}
        onlineServers={onlineServers}
        attentionServers={attentionServers}
        onlinePercent={onlinePercent}
        isLive={isConnected}
        dataUnavailable={serversUnavailable}
      />

      {serversError && (
        <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
          Failed to load servers: {serversError.message}
        </Alert>
      )}
      {worldsError && (
        <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
          Failed to load worlds: {worldsError.message}
        </Alert>
      )}

      <Box sx={metricItemSx}>
        <BentoMetricCard
          title="Total Servers"
          value={serversUnavailable ? 'Unavailable' : totalServers}
          icon={<ServerIcon fontSize="small" />}
          accent="primary"
          progress={!serversUnavailable && totalServers > 0 ? (onlineServers / totalServers) * 100 : undefined}
          description={serversUnavailable ? 'Server data unavailable' : `${onlineServers} running · ${stoppedServers} stopped`}
        />
      </Box>
      <Box sx={metricItemSx}>
        <BentoMetricCard
          title="Online Servers"
          value={serversUnavailable ? 'Unavailable' : onlineServers}
          unit={!serversUnavailable && totalServers > 0 ? `/ ${totalServers}` : undefined}
          icon={<OnlineIcon fontSize="small" />}
          accent="success"
          progress={!serversUnavailable && totalServers > 0 ? onlinePercent : undefined}
          description={serversUnavailable ? 'Server data unavailable' : `${onlinePercent}% running`}
        />
      </Box>
      <Box sx={metricItemSx}>
        <BentoMetricCard
          title="Online Players"
          value={totalPlayers ?? '—'}
          icon={<PlayersIcon fontSize="small" />}
          accent="info"
          description={totalPlayers === null ? 'Player data unavailable' : 'Across all servers'}
        />
      </Box>
      <Box sx={metricItemSx}>
        <BentoMetricCard
          title="Total Worlds"
          value={worldsUnavailable ? 'Unavailable' : totalWorlds}
          icon={<WorldIcon fontSize="small" />}
          accent="secondary"
          progress={!worldsUnavailable && totalWorlds > 0 ? (assignedWorlds / totalWorlds) * 100 : undefined}
          description={worldsUnavailable ? 'World data unavailable' : `${assignedWorlds} assigned · ${freeWorlds} free`}
        />
      </Box>

      <Box sx={{ ...cardItemSx, gridColumn: { xs: '1 / -1', md: 'span 8' } }}>
          {serversUnavailable ? (
            <BentoPanel sx={{ height: '100%' }}>
              <BentoPanelHeader title="Servers" />
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <Typography color="text.secondary">Servers unavailable</Typography>
              </Box>
            </BentoPanel>
          ) : (
            <ServerOverview
              servers={serversData?.servers || []}
              statusMap={liveStatusMap}
              isLoading={serversLoading}
              maxItems={5}
              showViewAll={true}
            />
          )}
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
    </BentoGrid>
  );
}
