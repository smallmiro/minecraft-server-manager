'use client';

import Link from 'next/link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import PublicIcon from '@mui/icons-material/Public';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { usePlayitStatus } from '@/hooks/usePlayit';
import { BentoPanel, BentoPanelHeader } from '@/components/bento';

const TITLE = 'External Access';

function ManageButton() {
  return (
    <Button
      component={Link}
      href="/routing"
      size="small"
      endIcon={<ArrowForwardIcon />}
      sx={{ fontSize: 12 }}
    >
      Manage
    </Button>
  );
}

export function PlayitSummaryCard() {
  const { data, isLoading } = usePlayitStatus();

  if (isLoading) {
    return (
      <BentoPanel sx={{ height: '100%' }}>
        <BentoPanelHeader
          title={<Skeleton variant="text" width={120} />}
          icon={<Skeleton variant="circular" width={20} height={20} />}
          action={<Skeleton variant="rounded" width={60} height={24} />}
        />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Skeleton variant="text" width="50%" height={32} />
          <Skeleton variant="text" width="70%" />
        </Box>
      </BentoPanel>
    );
  }

  if (!data?.enabled) {
    return (
      <BentoPanel sx={{ height: '100%' }}>
        <BentoPanelHeader
          title={TITLE}
          icon={<PublicIcon fontSize="small" />}
          action={<Chip label="Not configured" size="small" variant="outlined" />}
        />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            playit.gg is not configured
          </Typography>
          <ManageButton />
        </Box>
      </BentoPanel>
    );
  }

  const isRunning = data.agentRunning && data.containerStatus === 'running';
  const totalServers = data.servers.length;
  const configuredServers = data.servers.filter((s) => s.playitDomain).length;

  return (
    <BentoPanel accent={isRunning ? 'success' : 'neutral'} sx={{ height: '100%' }}>
      <BentoPanelHeader
        title={TITLE}
        icon={<PublicIcon fontSize="small" />}
        action={
          <Chip
            label={isRunning ? 'Running' : 'Stopped'}
            size="small"
            color={isRunning ? 'success' : 'default'}
            variant="outlined"
          />
        }
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Typography variant="h6" component="p" sx={{ mb: 0.5 }}>
          {configuredServers} / {totalServers} servers
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          With external domains
        </Typography>
        <ManageButton />
      </Box>
    </BentoPanel>
  );
}
