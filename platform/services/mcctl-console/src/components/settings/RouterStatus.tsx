'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import RouterIcon from '@mui/icons-material/Router';
import type { RouterDetail, ContainerStatus, HealthStatus } from '@/ports/api/IMcctlApiClient';

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

export function RouterStatus({ router }: RouterStatusProps) {
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Hostname</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {router.routes.map((route) => (
                <TableRow key={route.hostname}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {route.hostname}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {route.target}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={route.serverStatus}
                      size="small"
                      color={getContainerStatusColor(route.serverStatus)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
