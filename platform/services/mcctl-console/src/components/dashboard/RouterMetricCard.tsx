'use client';

import { Box, Skeleton } from '@mui/material';
import { Router as RouterIcon } from '@mui/icons-material';
import { BentoMetricCard, BentoPanel, type BentoAccent } from '@/components/bento';
import { useRouterStatus } from '@/hooks/useMcctl';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

const TITLE = 'mc-router';

const DOWN_STATUSES: RouterDetail['status'][] = ['exited', 'dead', 'not_found', 'not_created'];

/**
 * running + healthy/none -> success
 * running + unhealthy, or router down -> error
 * everything in between (starting, restarting, created, paused) -> warning
 */
function getRouterAccent(router: RouterDetail): BentoAccent {
  if (DOWN_STATUSES.includes(router.status) || router.health === 'unhealthy') return 'error';
  if (router.status === 'running' && router.health !== 'starting') return 'success';
  return 'warning';
}

export function RouterMetricCard() {
  const { data, isLoading } = useRouterStatus();

  if (isLoading) {
    return (
      <BentoPanel
        component="article"
        aria-label={TITLE}
        aria-busy="true"
        sx={{ height: '100%', minHeight: 152 }}
      >
        <Box sx={{ p: 2.25 }}>
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="text" width="35%" height={38} />
          <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
        </Box>
      </BentoPanel>
    );
  }

  // React Query keeps `data` when a background refetch fails; only show the error without it
  if (!data) {
    return (
      <BentoMetricCard
        title={TITLE}
        value="—"
        icon={<RouterIcon fontSize="small" />}
        accent="error"
        description="Router status unavailable"
      />
    );
  }

  const { router } = data;
  const routeCount = router.routes.length;
  const description = [
    router.status,
    router.health !== 'none' && router.health !== 'unknown' ? router.health : null,
    `${routeCount} ${routeCount === 1 ? 'route' : 'routes'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <BentoMetricCard
      title={TITLE}
      value={`:${router.port}`}
      icon={<RouterIcon fontSize="small" />}
      accent={getRouterAccent(router)}
      description={description}
    />
  );
}
