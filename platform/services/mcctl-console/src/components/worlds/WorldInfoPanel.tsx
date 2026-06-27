'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useWorldInfo, useWorldPlayers, useLivePlayers } from '@/hooks/useMcctl';
import { WorldInfoCards } from './WorldInfoCards';
import { PlayerLocationList } from './PlayerLocationList';
import { WorldMapPanel } from './WorldMapPanel';

export interface WorldInfoPanelProps {
  worldName: string;
  /** When provided, live player positions are polled for this server. */
  serverName?: string;
}

/**
 * World info panel: metadata cards + player locations (#525, Phase 1).
 * Shared between the server detail "World" tab and the world management view.
 */
export function WorldInfoPanel({ worldName, serverName }: WorldInfoPanelProps) {
  const infoQuery = useWorldInfo(worldName);
  const offlineQuery = useWorldPlayers(worldName);
  const liveQuery = useLivePlayers(serverName ?? '', { enabled: Boolean(serverName) });

  if (infoQuery.isLoading) {
    return (
      <Box data-testid="world-info-loading">
        <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={120} />
      </Box>
    );
  }

  if (infoQuery.isError || !infoQuery.data) {
    return (
      <Alert severity="error" data-testid="world-info-error">
        Failed to load world info{infoQuery.error ? `: ${infoQuery.error.message}` : ''}
      </Alert>
    );
  }

  const info = infoQuery.data.info;
  const offline = offlineQuery.data?.players ?? [];
  const live = liveQuery.data?.players ?? [];
  // We can't distinguish "stopped" from "running but empty" here, so keep the
  // message neutral: simply note that the shown positions are last-known.
  const noPlayersOnline = Boolean(serverName) && live.length === 0;

  return (
    <Stack spacing={3} data-testid="world-info-panel">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          🌍 {info.name}
        </Typography>
        <Chip
          size="small"
          label="Overworld"
          color={info.dimensions.overworld ? 'success' : 'default'}
          variant={info.dimensions.overworld ? 'filled' : 'outlined'}
        />
        <Chip
          size="small"
          label="Nether"
          color={info.dimensions.nether ? 'success' : 'default'}
          variant={info.dimensions.nether ? 'filled' : 'outlined'}
        />
        <Chip
          size="small"
          label="End"
          color={info.dimensions.end ? 'success' : 'default'}
          variant={info.dimensions.end ? 'filled' : 'outlined'}
        />
      </Box>

      <WorldInfoCards info={info} />

      <WorldMapPanel worldName={worldName} />

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          👥 Players
        </Typography>
        {noPlayersOnline && (
          <Alert severity="info" sx={{ mb: 1 }} data-testid="world-info-offline-note">
            No players online — showing last known (offline) locations.
          </Alert>
        )}
        <PlayerLocationList offline={offline} live={live} />
      </Box>
    </Stack>
  );
}
