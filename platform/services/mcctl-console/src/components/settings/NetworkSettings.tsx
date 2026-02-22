'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

interface NetworkSettingsProps {
  router: RouterDetail;
}

function getModeLabel(mode?: string): string {
  if (!mode) return 'Unknown';
  if (mode.includes('in-docker') || mode.includes('auto-discovery')) return 'Auto Discovery';
  if (mode.includes('mapping')) return 'Manual Mapping';
  return mode;
}

const cellLabelSx = { fontWeight: 500, color: 'text.secondary', border: 0, width: '40%', py: 1 } as const;
const cellValueSx = { border: 0, py: 1 } as const;

export function NetworkSettings({ router }: NetworkSettingsProps) {
  const activeRoutes = router.routes.filter((r) => r.serverStatus === 'running').length;
  const totalRoutes = router.routes.length;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <NetworkCheckIcon color="primary" />
          <Typography variant="h6" component="h2">
            Network Settings
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={cellLabelSx}>Listening Port</TableCell>
                <TableCell sx={cellValueSx}>
                  <Chip label={router.port} size="small" variant="outlined" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={cellLabelSx}>Routing Mode</TableCell>
                <TableCell sx={cellValueSx}>
                  <Chip label={getModeLabel(router.mode)} size="small" color="info" variant="outlined" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={cellLabelSx}>Total Routes</TableCell>
                <TableCell sx={cellValueSx}>{totalRoutes}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={cellLabelSx}>Active Routes</TableCell>
                <TableCell sx={cellValueSx}>
                  <Chip
                    label={`${activeRoutes} / ${totalRoutes}`}
                    size="small"
                    color={activeRoutes > 0 ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}
