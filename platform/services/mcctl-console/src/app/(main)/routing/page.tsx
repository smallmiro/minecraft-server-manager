'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import RouterIcon from '@mui/icons-material/Router';
import { BentoGrid, BentoPanel, PageHero } from '@/components/bento';
import { PlatformInfo, RouterStatus, NetworkSettings, AvahiStatus, PlayitSection } from '@/components/settings';
import { useRouterStatus } from '@/hooks/useMcctl';

const embeddedCardSx = {
  height: '100%',
  '& > .MuiCard-root': {
    height: '100%',
    border: 0,
    borderRadius: 0,
    boxShadow: 'none',
    backgroundColor: 'transparent',
  },
};

function SkeletonPanel({ featured = false }: { featured?: boolean }) {
  return (
    <BentoPanel
      data-testid="routing-skeleton-panel"
      aria-label="Routing content loading"
      sx={{
        p: 2.5,
        minHeight: featured ? 320 : 176,
        gridColumn: { xs: 'span 1', sm: featured ? 'span 6' : 'span 3', md: featured ? 'span 8' : 'span 4' },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
        <Skeleton variant="rounded" width={36} height={36} />
        <Skeleton variant="text" width="45%" height={30} />
      </Stack>
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} variant="text" width={row % 2 === 0 ? '78%' : '58%'} />
      ))}
    </BentoPanel>
  );
}

export default function RoutingPage() {
  const { data, isLoading, error } = useRouterStatus();
  const router = data?.router;
  const statusLabel = isLoading ? 'Checking' : router?.status ?? 'Unavailable';
  const statusColor = isLoading ? 'default' : router?.status === 'running' ? 'success' : router ? 'warning' : 'error';

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <PageHero
        compact
        title="Routing"
        description="Server routing and network configuration"
        eyebrow="Network"
        icon={<RouterIcon />}
        status={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip aria-label="Router status" label={statusLabel} color={statusColor} size="small" />
            <Chip
              aria-label="Route count"
              label={router ? `${router.routes.length} routes` : 'No route data'}
              size="small"
              variant="outlined"
            />
          </Stack>
        }
      />

      {error && (
        <Alert severity="error">
          Failed to load router status: {error.message}
        </Alert>
      )}

      {isLoading ? (
        <BentoGrid aria-label="Routing content loading">
          <SkeletonPanel featured />
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </BentoGrid>
      ) : router ? (
        <BentoGrid aria-label="Routing configuration">
          <BentoPanel
            role="region"
            aria-label="Router routes"
            accent="primary"
            sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 8' } }}
          >
            <RouterStatus router={router} />
          </BentoPanel>
          <BentoPanel
            role="region"
            aria-label="Platform information"
            sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 4' } }}
          >
            <PlatformInfo router={router} />
          </BentoPanel>
          <BentoPanel
            role="region"
            aria-label="Network settings"
            sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 4' } }}
          >
            <NetworkSettings router={router} />
          </BentoPanel>
          <BentoPanel
            role="region"
            aria-label="Avahi status"
            sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 4' } }}
          >
            <AvahiStatus avahi={data.avahi} />
          </BentoPanel>
          <BentoPanel
            role="region"
            aria-label="Playit tunnel"
            sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 4' } }}
          >
            <PlayitSection />
          </BentoPanel>
        </BentoGrid>
      ) : (
        <BentoPanel accent="warning" sx={{ p: 3 }}>
          <Box color="text.secondary">Router status is unavailable.</Box>
        </BentoPanel>
      )}
    </Stack>
  );
}
