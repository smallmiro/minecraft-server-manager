'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LanIcon from '@mui/icons-material/Lan';
import RouterIcon from '@mui/icons-material/Router';
import { BentoMetricCard, BentoPanelHeader } from '@/components/bento';
import type { ContainerStatus, HealthStatus, RouterDetail } from '@/ports/api/IMcctlApiClient';
import type { StatusColor } from './hostnameType';

interface RouterGatewayCardProps {
  router: RouterDetail;
}

function getHealthColor(health: HealthStatus): StatusColor {
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

// Unlike game servers, a stopped mc-router is an outage: nothing wakes it on connect.
function getRouterStatusColor(status: ContainerStatus): StatusColor {
  switch (status) {
    case 'running':
      return 'success';
    case 'restarting':
    case 'paused':
      return 'warning';
    default:
      return 'error';
  }
}

function getModeLabel(mode?: string): string {
  if (!mode) return 'Unknown';
  if (mode.includes('in-docker') || mode.includes('auto-discovery')) return 'Auto Discovery';
  if (mode.includes('mapping')) return 'Manual Mapping';
  return mode;
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body1" component="div" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Box>
  );
}

export function RouterGatewayCard({ router }: RouterGatewayCardProps) {
  const activeRoutes = router.routes.filter((r) => r.serverStatus === 'running').length;
  const totalRoutes = router.routes.length;
  const statusColor = getRouterStatusColor(router.status);

  return (
    <>
      <BentoPanelHeader title="mc-router Gateway" icon={<RouterIcon fontSize="small" />} />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip aria-label="Router container status" label={router.status} size="small" color={statusColor} />
          <Chip
            aria-label="Router health"
            label={router.health}
            size="small"
            color={getHealthColor(router.health)}
            variant="outlined"
          />
        </Stack>
        <Box
          data-testid="gateway-metrics"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 1.5,
          }}
        >
          <BentoMetricCard title="Port" value={router.port} accent="info" icon={<LanIcon fontSize="small" />} />
          <BentoMetricCard
            title="Active routes"
            value={`${activeRoutes} / ${totalRoutes}`}
            accent={activeRoutes > 0 ? 'success' : 'neutral'}
            progress={totalRoutes > 0 ? (activeRoutes / totalRoutes) * 100 : 0}
          />
        </Box>
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <Metric label="Container">{router.name}</Metric>
          <Metric label="Mode">{getModeLabel(router.mode)}</Metric>
          <Metric label="Uptime">{router.uptime || '-'}</Metric>
        </Stack>
      </Box>
    </>
  );
}
