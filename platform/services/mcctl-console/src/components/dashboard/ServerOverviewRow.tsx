'use client';

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import NextLink from 'next/link';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  ErrorOutline as CopyFailedIcon,
  PlayArrow as StartIcon,
  RestartAlt as RestartIcon,
  Stop as StopIcon,
  Terminal as ConsoleIcon,
} from '@mui/icons-material';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import { HostnameDisplay } from '@/components/common';
import { startLoading } from '@/components/providers';
import { BentoPanel, type BentoAccent } from '@/components/bento';
import { useCopy } from '@/hooks/useCopy';
import { useRestartServer, useStartServer, useStopServer } from '@/hooks/useMcctl';
import { getPrimaryHostname } from '@/utils/hostname';

/**
 * Metrics that the server list endpoint does not provide yet. The row reads them
 * as optional fields so adding them to ServerSummary is all that is needed to
 * make the metrics slot appear.
 */
interface ServerRowMetrics {
  type?: string;
  version?: string;
  memory?: string;
  players?: { online: number; max: number } | null;
  stats?: { memoryUsage: number; memoryLimit: number } | null;
}

export interface ServerOverviewRowProps {
  server: ServerSummary;
  status: string;
  health: string;
  onClick: (serverName: string) => void;
  onActionError?: (message: string) => void;
}

type ConfirmAction = 'stop' | 'restart';

const STARTABLE_STATUSES = ['stopped', 'exited', 'created', 'not_created'];

function getStatusColor(status: string): 'success' | 'error' | 'default' | 'warning' {
  switch (status) {
    case 'running':
      return 'success';
    case 'stopped':
    case 'exited':
      return 'error';
    case 'created':
      return 'warning';
    default:
      return 'default';
  }
}

function getHealthColor(health: string): 'success' | 'error' | 'warning' | 'default' {
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

function getAccent(status: string, health: string): BentoAccent {
  if (health === 'unhealthy') return 'error';
  if (status === 'running') return 'success';
  return 'neutral';
}

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

const stopPropagation = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

function MetricsSlot({ server }: { server: ServerSummary & ServerRowMetrics }) {
  const cells: { label: string; value: string }[] = [];

  if (server.players) {
    cells.push({ label: 'Players', value: `${server.players.online} / ${server.players.max}` });
  }
  if (server.stats) {
    cells.push({
      label: 'Memory',
      value: `${formatBytes(server.stats.memoryUsage)} / ${formatBytes(server.stats.memoryLimit)}`,
    });
  } else if (server.memory) {
    cells.push({ label: 'Memory', value: server.memory });
  }
  const typeVersion = [server.type, server.version].filter(Boolean).join(' · ');
  if (typeVersion) {
    cells.push({ label: 'Type', value: typeVersion });
  }

  if (cells.length === 0) return null;

  return (
    <Box
      data-testid="server-row-metrics"
      sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5, mt: 1.5, minWidth: 0 }}
    >
      {cells.map((cell) => (
        <Box key={cell.label} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {cell.label}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {cell.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function ServerOverviewRow({
  server,
  status,
  health,
  onClick,
  onActionError,
}: ServerOverviewRowProps) {
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();
  const { status: copyStatus, copy } = useCopy();

  const name = server.name;
  const hostname = getPrimaryHostname(server.hostname);
  const isRunning = status === 'running';
  const canStart = STARTABLE_STATUSES.includes(status);
  const busy = startServer.isPending || stopServer.isPending || restartServer.isPending;

  const reportError = (verb: string) => (error: Error) =>
    onActionError?.(`Failed to ${verb} ${name}: ${error.message}`);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(name);
    }
  };

  const handleConfirm = () => {
    const action = confirming;
    setConfirming(null);
    if (action === 'stop') {
      stopServer.mutate(name, { onError: reportError('stop') });
    } else if (action === 'restart') {
      restartServer.mutate(name, { onError: reportError('restart') });
    }
  };

  const spinner = <CircularProgress size={18} color="inherit" />;

  const copyLabel =
    copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : 'Copy hostname';
  const CopyStateIcon =
    copyStatus === 'copied' ? CheckIcon : copyStatus === 'failed' ? CopyFailedIcon : CopyIcon;

  return (
    <BentoPanel
      component="div"
      interactive
      accent={getAccent(status, health)}
      onClick={() => onClick(name)}
      sx={{ p: 2, cursor: 'pointer' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box
          role="button"
          tabIndex={0}
          aria-label={`Open ${name}`}
          onKeyDown={handleKeyDown}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            flex: '1 1 160px',
            minWidth: 0,
            borderRadius: 1,
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ minWidth: 0, maxWidth: '100%' }}>
            {name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Chip label={status} color={getStatusColor(status)} size="small" />
            {health !== 'none' && (
              <Chip label={health} color={getHealthColor(health)} size="small" variant="outlined" />
            )}
          </Box>
        </Box>

        <Box onClick={stopPropagation} onKeyDown={stopPropagation} sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
          {isRunning && (
            <>
              <Tooltip title="Console">
                <IconButton
                  size="small"
                  component={NextLink}
                  href={`/servers/${encodeURIComponent(name)}/console`}
                  onClick={() => startLoading()}
                  aria-label={`Console ${name}`}
                >
                  <ConsoleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Restart">
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Restart ${name}`}
                    disabled={busy}
                    onClick={() => setConfirming('restart')}
                  >
                    {restartServer.isPending ? spinner : <RestartIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Stop">
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Stop ${name}`}
                    disabled={busy}
                    onClick={() => setConfirming('stop')}
                  >
                    {stopServer.isPending ? spinner : <StopIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          {canStart && (
            <Tooltip title="Start">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Start ${name}`}
                  disabled={busy}
                  onClick={() => startServer.mutate(name, { onError: reportError('start') })}
                >
                  {startServer.isPending ? spinner : <StartIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Clicks here (incl. HostnameDisplay's popover, which bubbles through the portal) must not open the server */}
      <Box onClick={stopPropagation} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, minWidth: 0 }}>
        <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
          <HostnameDisplay hostname={server.hostname} fontSize={12} />
        </Box>
        {hostname !== '-' && (
          <Tooltip title={copyLabel}>
            <IconButton
              size="small"
              aria-label={`Copy hostname of ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                void copy(hostname);
              }}
              sx={{ p: 0.25, color: copyStatus === 'failed' ? 'error.main' : copyStatus === 'copied' ? 'success.main' : 'text.secondary' }}
            >
              <CopyStateIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <MetricsSlot server={server as ServerSummary & ServerRowMetrics} />

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onClick={stopPropagation}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{confirming === 'restart' ? 'Restart Server' : 'Stop Server'}</DialogTitle>
        <DialogContent>
          <Typography>
            {confirming === 'restart'
              ? `Restart ${name}? Connected players will be disconnected.`
              : `Stop ${name}? Connected players will be disconnected.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleConfirm}>
            {confirming === 'restart' ? 'Restart' : 'Stop'}
          </Button>
        </DialogActions>
      </Dialog>
    </BentoPanel>
  );
}
