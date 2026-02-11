'use client';

import Link from 'next/link';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import PublicIcon from '@mui/icons-material/Public';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { usePlayitStatus } from '@/hooks/usePlayit';

export function PlayitSummaryCard() {
  const { data, isLoading } = usePlayitStatus();

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Skeleton variant="circular" width={20} height={20} />
              <Skeleton variant="text" width={120} />
            </Box>
            <Skeleton variant="rounded" width={60} height={24} />
          </Box>
          <Skeleton variant="text" width="50%" height={32} />
          <Skeleton variant="text" width="70%" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.enabled) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PublicIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500} color="text.secondary">
                External Access
              </Typography>
            </Box>
            <Chip label="Not configured" size="small" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            playit.gg is not configured
          </Typography>
          <Button
            component={Link}
            href="/routing"
            size="small"
            endIcon={<ArrowForwardIcon />}
            sx={{ fontSize: 12 }}
          >
            Manage
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isRunning = data.agentRunning && data.containerStatus === 'running';
  const totalServers = data.servers.length;
  const configuredServers = data.servers.filter((s) => s.playitDomain).length;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PublicIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="body2" fontWeight={500}>
              External Access
            </Typography>
          </Box>
          <Chip
            label={isRunning ? 'Running' : 'Stopped'}
            size="small"
            color={isRunning ? 'success' : 'default'}
            variant="outlined"
          />
        </Box>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {configuredServers} / {totalServers} servers
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          With external domains
        </Typography>
        <Button
          component={Link}
          href="/routing"
          size="small"
          endIcon={<ArrowForwardIcon />}
          sx={{ fontSize: 12 }}
        >
          Manage
        </Button>
      </CardContent>
    </Card>
  );
}
