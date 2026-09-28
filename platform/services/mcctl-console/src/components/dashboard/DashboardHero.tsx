'use client';

import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  DashboardRounded as DashboardIcon,
  SensorsRounded as LiveIcon,
  SyncRounded as ReconnectingIcon,
} from '@mui/icons-material';
import { BentoPanel } from '@/components/bento';

interface DashboardHeroProps {
  totalServers: number;
  onlineServers: number;
  attentionServers: number;
  onlinePercent: number;
  isLive: boolean;
}

export function DashboardHero({
  totalServers,
  onlineServers,
  attentionServers,
  onlinePercent,
  isLive,
}: DashboardHeroProps) {
  const attentionMessage = totalServers === 0
    ? 'No servers configured'
    : attentionServers === 0
      ? 'All systems operational'
      : `${attentionServers} ${attentionServers === 1 ? 'server needs' : 'servers need'} attention`;

  return (
    <BentoPanel
      accent="primary"
      sx={{
        gridColumn: { xs: '1 / -1', md: 'span 6' },
        gridRow: { md: 'span 2' },
        minHeight: { xs: 280, md: 328 },
        p: { xs: 3, sm: 4 },
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 4,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.32),
        background: (theme) =>
          `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.secondary.main, 0.11)} 48%, ${theme.palette.background.paper} 100%)`,
        boxShadow: (theme) => `0 28px 70px ${alpha(theme.palette.common.black, 0.24)}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 220,
          height: 220,
          top: -100,
          right: -70,
          borderRadius: 8,
          transform: 'rotate(24deg)',
          background: (theme) => alpha(theme.palette.primary.main, 0.08),
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 120,
          height: 120,
          right: 70,
          bottom: -72,
          borderRadius: 5,
          transform: 'rotate(24deg)',
          background: (theme) => alpha(theme.palette.secondary.main, 0.1),
        },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 42,
                height: 42,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                color: 'primary.main',
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              }}
            >
              <DashboardIcon />
            </Box>
            <Typography
              variant="overline"
              sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.14em' }}
            >
              Control center
            </Typography>
          </Stack>
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
        </Stack>

        <Typography
          component="h1"
          sx={{
            mt: 3,
            fontSize: { xs: '2rem', sm: '2.65rem' },
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.04em',
          }}
        >
          Dashboard
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 460 }}>
          Your Minecraft infrastructure, worlds, and activity at a glance.
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, mt: 4 }}>
        <Typography
          sx={{
            fontSize: { xs: '1.65rem', sm: '2rem' },
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.035em',
          }}
        >
          {onlineServers} of {totalServers} servers online
        </Typography>
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
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1.25, color: attentionServers > 0 ? 'warning.light' : 'success.light' }}
        >
          {attentionMessage}
        </Typography>
      </Box>
    </BentoPanel>
  );
}
