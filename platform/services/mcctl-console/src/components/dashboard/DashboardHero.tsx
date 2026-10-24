'use client';

import NextLink from 'next/link';
import {
  Button,
  Chip,
  LinearProgress,
  Typography,
  alpha,
} from '@mui/material';
import {
  AddRounded as AddIcon,
  DashboardRounded as DashboardIcon,
  SensorsRounded as LiveIcon,
  SyncRounded as ReconnectingIcon,
} from '@mui/icons-material';
import { PageHero } from '@/components/bento';
import { startLoading } from '@/components/providers';

interface DashboardHeroProps {
  totalServers: number;
  onlineServers: number;
  attentionServers: number;
  onlinePercent: number;
  isLive: boolean;
  dataUnavailable?: boolean;
}

export function DashboardHero({
  totalServers,
  onlineServers,
  attentionServers,
  onlinePercent,
  isLive,
  dataUnavailable = false,
}: DashboardHeroProps) {
  const attentionMessage = dataUnavailable
    ? 'Server data unavailable'
    : totalServers === 0
    ? 'No servers configured'
    : attentionServers === 0
      ? 'All systems operational'
      : `${attentionServers} ${attentionServers === 1 ? 'server needs' : 'servers need'} attention`;

  return (
    <PageHero
      eyebrow="Control center"
      icon={<DashboardIcon />}
      status={
        <Chip
          icon={isLive ? <LiveIcon /> : <ReconnectingIcon />}
          label={isLive ? 'Live' : 'Reconnecting'}
          size="small"
          sx={{
            bgcolor: (theme) => alpha(
              isLive ? theme.palette.success.main : theme.palette.text.secondary,
              0.1,
            ),
            color: isLive ? 'success.light' : 'text.secondary',
            border: (theme) => `1px solid ${alpha(
              isLive ? theme.palette.success.main : theme.palette.text.secondary,
              0.24,
            )}`,
            '& .MuiChip-icon': { color: isLive ? 'success.main' : 'text.secondary' },
          }}
        />
      }
      actions={
        <Button
          component={NextLink}
          href="/servers?create=1"
          onClick={() => startLoading()}
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Create Server
        </Button>
      }
      title="Dashboard"
      description="Your Minecraft infrastructure, worlds, and activity at a glance."
      sx={{
        gridColumn: '1 / -1',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: '1.65rem', sm: '2rem' },
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.035em',
        }}
      >
        {dataUnavailable ? 'Server status unavailable' : `${onlineServers} of ${totalServers} servers online`}
      </Typography>
      {!dataUnavailable && (
        <LinearProgress
          variant="determinate"
          value={onlinePercent}
          aria-label="Online server percentage"
          sx={{
            mt: 2,
            height: 7,
            borderRadius: 999,
            bgcolor: (theme) => alpha(theme.palette.common.white, 0.08),
            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
              background: (theme) =>
                `linear-gradient(90deg, ${theme.palette.primary.dark}, ${theme.palette.primary.light})`,
            },
          }}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 1.25,
          color: dataUnavailable || attentionServers > 0 ? 'warning.light' : 'success.light',
        }}
      >
        {attentionMessage}
      </Typography>
    </PageHero>
  );
}
