'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CellTowerIcon from '@mui/icons-material/CellTower';
import type { AvahiInfo } from '@/ports/api/IMcctlApiClient';

interface AvahiStatusProps {
  avahi?: AvahiInfo;
}

type ChipColor = 'success' | 'error' | 'warning' | 'default';

function getStatusColor(status: string): ChipColor {
  if (status === 'running') return 'success';
  if (status.includes('not running')) return 'warning';
  if (status === 'not installed') return 'error';
  return 'default';
}

export function AvahiStatus({ avahi }: AvahiStatusProps) {
  const status = avahi?.status ?? 'unknown';

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CellTowerIcon color="primary" />
          <Typography variant="h6" component="h2">
            mDNS (Avahi)
          </Typography>
          <Chip
            label={status}
            size="small"
            color={getStatusColor(status)}
            sx={{ ml: 'auto' }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Avahi mDNS daemon enables <code>.local</code> hostname resolution for Minecraft servers on the local network.
        </Typography>
      </CardContent>
    </Card>
  );
}
