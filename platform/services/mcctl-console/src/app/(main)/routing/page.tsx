'use client';

import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RouterIcon from '@mui/icons-material/Router';
import { BentoGrid, BentoPanel, PageHero } from '@/components/bento';
import {
  RestartRouterDialog,
  RoutingTable,
  RouterGatewayCard,
  RouterResolverCard,
  extractServerName,
} from '@/components/routing';
import { PlayitSection } from '@/components/settings';
import { useRestartRouter, useRouterStatus } from '@/hooks/useMcctl';
import { usePlayitStatus } from '@/hooks/usePlayit';

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
        gridColumn: { xs: 'span 1', sm: featured ? 'span 6' : 'span 3', md: featured ? 'span 12' : 'span 4' },
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
  const { data: playit } = usePlayitStatus();
  const playitDomains = useMemo(() => (playit?.servers ?? []).map((server) => server.playitDomain), [playit?.servers]);
  const restartRouter = useRestartRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const router = data?.router;
  const firstRoute = router?.routes[0];

  const handleRestart = () => {
    restartRouter.mutate(undefined, {
      onSuccess: (result) => {
        setConfirmOpen(false);
        setSnackbar({ open: true, message: result.message || 'mc-router restarted', severity: 'success' });
      },
      onError: (restartError) => {
        setConfirmOpen(false);
        setSnackbar({
          open: true,
          message: `Failed to restart mc-router: ${restartError.message}`,
          severity: 'error',
        });
      },
    });
  };

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
        actions={
          <Button
            variant="outlined"
            color="warning"
            startIcon={restartRouter.isPending ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
            disabled={restartRouter.isPending || !router}
            onClick={() => setConfirmOpen(true)}
          >
            Restart mc-router
          </Button>
        }
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
        </BentoGrid>
      ) : router ? (
        <BentoGrid aria-label="Routing configuration">
          <BentoPanel
            role="region"
            aria-label="Router routes"
            accent="primary"
            sx={{ gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' } }}
          >
            <RoutingTable routes={router.routes} playitDomains={playitDomains} />
          </BentoPanel>
          <BentoPanel
            role="region"
            aria-label="mc-router Gateway"
            sx={{ gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 4' } }}
          >
            <RouterGatewayCard router={router} />
          </BentoPanel>
          <BentoPanel
            role="region"
            aria-label="Hostname resolver"
            sx={{ gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 4' } }}
          >
            <RouterResolverCard
              resolver={router.resolver}
              avahi={data.avahi}
              serverName={firstRoute ? extractServerName(firstRoute.target) : undefined}
            />
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

      <RestartRouterDialog
        open={confirmOpen}
        pending={restartRouter.isPending}
        onConfirm={handleRestart}
        onCancel={() => setConfirmOpen(false)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
