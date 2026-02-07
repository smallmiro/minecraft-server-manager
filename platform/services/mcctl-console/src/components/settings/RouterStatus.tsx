'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import RouterIcon from '@mui/icons-material/Router';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { RouterDetail, ContainerStatus, HealthStatus, RouteInfo } from '@/ports/api/IMcctlApiClient';

interface RouterStatusProps {
  router: RouterDetail;
}

type ChipColor = 'success' | 'error' | 'warning' | 'default';

function getContainerStatusColor(status: ContainerStatus): ChipColor {
  switch (status) {
    case 'running':
      return 'success';
    case 'exited':
    case 'dead':
    case 'not_found':
    case 'not_created':
      return 'error';
    case 'created':
    case 'restarting':
    case 'paused':
      return 'warning';
    default:
      return 'default';
  }
}

function getHealthColor(health: HealthStatus): ChipColor {
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

function getStatusDotColor(status: ContainerStatus): string {
  switch (status) {
    case 'running':
      return '#4caf50';
    case 'exited':
    case 'dead':
    case 'not_found':
    case 'not_created':
      return '#f44336';
    case 'created':
    case 'restarting':
    case 'paused':
      return '#ff9800';
    default:
      return '#9e9e9e';
  }
}

function StatusDot({ status }: { status: ContainerStatus }) {
  return (
    <Tooltip title={status} arrow>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: getStatusDotColor(status),
          flexShrink: 0,
          boxShadow: status === 'running' ? `0 0 6px ${getStatusDotColor(status)}` : 'none',
        }}
      />
    </Tooltip>
  );
}

function extractServerName(target: string): string {
  return target.replace(/^mc-/, '').replace(/:25565$/, '');
}

interface ServerGroup {
  status: ContainerStatus;
  hostnames: string[];
  serverType?: string;
  serverVersion?: string;
}

function groupRoutesByServer(routes: RouteInfo[]): Map<string, ServerGroup> {
  const groups = new Map<string, ServerGroup>();

  for (const route of routes) {
    const serverName = extractServerName(route.target);
    const existing = groups.get(serverName);
    if (existing) {
      existing.hostnames.push(route.hostname);
    } else {
      groups.set(serverName, {
        status: route.serverStatus,
        hostnames: [route.hostname],
        serverType: route.serverType,
        serverVersion: route.serverVersion,
      });
    }
  }

  return groups;
}

export function RouterStatus({ router }: RouterStatusProps) {
  const serverGroups = groupRoutesByServer(router.routes);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <RouterIcon color="primary" />
          <Typography variant="h6" component="h2">
            MC-Router Status
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Chip
              label={router.status}
              size="small"
              color={getContainerStatusColor(router.status)}
            />
            <Chip
              label={router.health}
              size="small"
              color={getHealthColor(router.health)}
              variant="outlined"
            />
          </Box>
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1, mt: 3 }}>
          Routing Table
        </Typography>

        {router.routes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No routes configured
          </Typography>
        ) : (
          <Box sx={{ mt: 1 }}>
            {Array.from(serverGroups.entries()).map(([serverName, { status, hostnames, serverType, serverVersion }]) => (
              <Accordion key={serverName} defaultExpanded disableGutters elevation={0} sx={{
                border: 1,
                borderColor: 'divider',
                '&:not(:last-child)': { borderBottom: 0 },
                '&::before': { display: 'none' },
              }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 1 }}>
                    <StatusDot status={status} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {serverName}
                    </Typography>
                    {(serverType || serverVersion) && (
                      <Typography variant="caption" color="text.secondary">
                        {[serverType, serverVersion].filter(Boolean).join(' ')}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {hostnames.length} {hostnames.length === 1 ? 'route' : 'routes'}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {hostnames.map((hostname) => (
                      <Typography
                        key={hostname}
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.secondary' }}
                      >
                        {hostname}
                      </Typography>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
