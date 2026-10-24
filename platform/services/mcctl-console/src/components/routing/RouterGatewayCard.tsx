'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LanIcon from '@mui/icons-material/Lan';
import RouterIcon from '@mui/icons-material/Router';
import { BentoMetricCard } from '@/components/bento';
import type { HealthStatus, RouterDetail } from '@/ports/api/IMcctlApiClient';
import { routeStatusDisplay, type StatusColor } from './hostnameType';

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
  // Container status uses the same palette mapping as route rows.
  const statusColor = routeStatusDisplay(router.status).color;

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <RouterIcon color="primary" />
        <Typography variant="h6" component="h2">
          mc-router Gateway
        </Typography>
      </Stack>
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
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
        <BentoMetricCard title="Port" value={router.port} accent="info" icon={<LanIcon fontSize="small" />} />
        <BentoMetricCard
          title="Active routes"
          value={`${activeRoutes} / ${totalRoutes}`}
          accent={activeRoutes > 0 ? 'success' : 'neutral'}
          progress={totalRoutes > 0 ? (activeRoutes / totalRoutes) * 100 : 0}
        />
      </Box>
      <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
        <Metric label="Mode">{getModeLabel(router.mode)}</Metric>
        <Metric label="Uptime">{router.uptime || '-'}</Metric>
      </Stack>
    </Box>
  );
}
