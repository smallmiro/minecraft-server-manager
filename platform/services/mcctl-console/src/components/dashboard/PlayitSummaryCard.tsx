'use client';

import Link from 'next/link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PublicIcon from '@mui/icons-material/Public';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useCopy } from '@/hooks/useCopy';
import { usePlayitStatus } from '@/hooks/usePlayit';
import { BentoPanel, BentoPanelHeader } from '@/components/bento';

const TITLE = 'External Access';
const MAX_LISTED_SERVERS = 3;

function PublicAddressRow({ serverName, address }: { serverName: string; address: string }) {
  const { status, copy } = useCopy();
  const label = status === 'copied' ? 'Copied!' : status === 'failed' ? 'Copy failed' : 'Copy address';
  const Icon = status === 'copied' ? CheckIcon : status === 'failed' ? ErrorOutlineIcon : ContentCopyIcon;

  return (
    <Box
      component="li"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, py: 0.5 }}
    >
      <Typography variant="body2" noWrap sx={{ fontWeight: 600, flexShrink: 0, maxWidth: '40%' }}>
        {serverName}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0, flex: 1 }}>
        {address}
      </Typography>
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={`Copy address of ${serverName}`}
          onClick={() => void copy(address)}
          sx={{ color: status === 'failed' ? 'error.main' : status === 'copied' ? 'success.main' : 'text.secondary' }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

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
  const domainServers = data.servers.filter((s) => s.playitDomain);
  const configuredServers = domainServers.length;
  const listedServers = domainServers.slice(0, MAX_LISTED_SERVERS);

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
        <Typography variant="body2" color="text.secondary" sx={{ mb: data.uptime && isRunning ? 0.5 : 2 }}>
          With external domains
        </Typography>
        {isRunning && data.uptime && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Uptime {data.uptime}
          </Typography>
        )}
        {listedServers.length > 0 && (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, mb: 2, p: 0 }}>
            {listedServers.map((server) => (
              <PublicAddressRow
                key={server.serverName}
                serverName={server.serverName}
                address={server.playitDomain as string}
              />
            ))}
          </Box>
        )}
        <ManageButton />
      </Box>
    </BentoPanel>
  );
}
