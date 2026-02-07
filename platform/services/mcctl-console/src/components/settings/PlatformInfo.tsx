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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

interface PlatformInfoProps {
  router: RouterDetail;
}

interface ModeDisplay {
  label: string;
  color: 'info' | 'default' | 'warning';
}

function getModeDisplay(mode?: string): ModeDisplay {
  if (!mode) return { label: 'Unknown', color: 'default' };
  if (mode.includes('in-docker') || mode.includes('auto-discovery')) {
    return { label: 'Auto Discovery', color: 'info' };
  }
  if (mode.includes('mapping')) {
    return { label: 'Manual Mapping', color: 'warning' };
  }
  return { label: mode, color: 'default' };
}

const cellLabelSx = { fontWeight: 500, color: 'text.secondary', border: 0, width: '40%', py: 1 } as const;
const cellValueSx = { border: 0, py: 1 } as const;

export function PlatformInfo({ router }: PlatformInfoProps) {
  const modeDisplay = getModeDisplay(router.mode);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoOutlinedIcon color="primary" />
          <Typography variant="h6" component="h2">
            Platform Information
          </Typography>
        </Box>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={cellLabelSx}>Router Name</TableCell>
              <TableCell sx={cellValueSx}>{router.name}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Port</TableCell>
              <TableCell sx={cellValueSx}>{router.port}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Mode</TableCell>
              <TableCell sx={cellValueSx}>
                <Chip label={modeDisplay.label} size="small" color={modeDisplay.color} variant="outlined" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Uptime</TableCell>
              <TableCell sx={cellValueSx}>{router.uptime || '-'}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
