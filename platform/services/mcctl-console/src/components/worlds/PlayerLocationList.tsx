'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCopy } from '@/hooks/useCopy';
import type { PlayerLocation } from '@/ports/api/IMcctlApiClient';

export interface PlayerLocationListProps {
  /** Offline locations parsed from playerdata. */
  offline: PlayerLocation[];
  /** Live (online) locations from RCON. Live entries take precedence. */
  live?: PlayerLocation[];
}

const DIMENSION_LABEL: Record<string, string> = {
  overworld: 'Overworld',
  nether: 'Nether',
  end: 'End',
};

/**
 * Merge offline + live player locations, preferring live entries by name.
 */
export function mergePlayers(
  offline: PlayerLocation[],
  live: PlayerLocation[]
): PlayerLocation[] {
  const liveNames = new Set(live.map((p) => (p.name ?? p.uuid).toLowerCase()));
  const offlineFiltered = offline.filter(
    (p) => !liveNames.has((p.name ?? p.uuid).toLowerCase())
  );
  return [...live, ...offlineFiltered];
}

const COPY_TITLE = { idle: 'Click to copy', copied: 'Copied', failed: 'Copy failed' } as const;

function CoordsCopy({ coords }: { coords: string }) {
  const { status, copy } = useCopy();
  return (
    <Tooltip title={COPY_TITLE[status]}>
      <Box
        component="span"
        onClick={() => void copy(coords)}
        sx={{
          cursor: 'pointer',
          color: status === 'failed' ? 'error.main' : 'text.secondary',
          fontFamily: 'monospace',
        }}
      >
        {coords}
      </Box>
    </Tooltip>
  );
}

/**
 * Player location list with online/offline badges and copyable coordinates (#525).
 */
export function PlayerLocationList({ offline, live = [] }: PlayerLocationListProps) {
  const players = mergePlayers(offline, live);

  if (players.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }} data-testid="player-list-empty">
        No player data available.
      </Typography>
    );
  }

  return (
    <Stack spacing={1} data-testid="player-location-list">
      {players.map((p) => {
        const coords = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
        const key = p.uuid || p.name || coords;
        return (
          <Card
            key={key}
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Chip
              size="small"
              label={p.online ? 'online' : 'offline'}
              color={p.online ? 'success' : 'default'}
              variant={p.online ? 'filled' : 'outlined'}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', minWidth: 80 }}>
              {p.name ?? p.uuid.slice(0, 8)}
            </Typography>
            <CoordsCopy coords={coords} />
            <Chip size="small" variant="outlined" label={DIMENSION_LABEL[p.dimension] ?? p.dimension} />
          </Card>
        );
      })}
    </Stack>
  );
}
