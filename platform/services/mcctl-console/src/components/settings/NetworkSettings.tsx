'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

interface NetworkSettingsProps {
  router: RouterDetail;
}

const cellLabelSx = { fontWeight: 500, color: 'text.secondary', border: 0, width: '40%', py: 1 } as const;
const cellValueSx = { border: 0, py: 1 } as const;

export function NetworkSettings({ router }: NetworkSettingsProps) {
  const activeRoutes = router.routes.filter((r) => r.serverStatus === 'running').length;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <NetworkCheckIcon color="primary" />
          <Typography variant="h6" component="h2">
            Network Settings
          </Typography>
        </Box>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={cellLabelSx}>Listening Port</TableCell>
              <TableCell sx={cellValueSx}>{router.port}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Routing Mode</TableCell>
              <TableCell sx={cellValueSx}>{router.mode || 'default'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Total Routes</TableCell>
              <TableCell sx={cellValueSx}>{router.routes.length}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Active Routes</TableCell>
              <TableCell sx={cellValueSx}>{activeRoutes}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
