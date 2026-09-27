'use client';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import PersonIcon from '@mui/icons-material/Person';
import { usePlayerDetail } from '@/hooks/useMcctl';
import type { PlayerSummary, PlayerStats } from '@/ports/api/IMcctlApiClient';

export interface PlayerDetailModalProps {
  serverName: string;
  player: PlayerSummary | null;
  open: boolean;
  onClose: () => void;
}

/** Format seconds as a human-readable "Xh Ym" (or "Ym" under an hour). */
export function formatPlayTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Format meters as "X km" (1 decimal) once >= 1000m, else "X m". */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ p: 1.5, height: '100%', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600} mt={0.5}>
        {value}
      </Typography>
    </Card>
  );
}

function StatisticsSection({ stats }: { stats: PlayerStats | null | undefined }) {
  if (!stats) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No statistics recorded yet.
      </Typography>
    );
  }

  const cells: Array<{ label: string; value: string }> = [
    { label: 'Play Time', value: formatPlayTime(stats.playTimeSeconds) },
    { label: 'Deaths', value: stats.deaths.toLocaleString() },
    { label: 'Mob Kills', value: stats.mobKills.toLocaleString() },
    { label: 'Player Kills', value: stats.playerKills.toLocaleString() },
    { label: 'Distance Traveled', value: formatDistance(stats.distanceMeters) },
    { label: 'Blocks Mined', value: stats.blocksMined.toLocaleString() },
    { label: 'Items Crafted', value: stats.itemsCrafted.toLocaleString() },
    { label: 'Advancements', value: stats.advancementsCompleted.toLocaleString() },
  ];

  return (
    <Grid container spacing={1.5}>
      {cells.map((c) => (
        <Grid item xs={6} sm={3} key={c.label}>
          <StatCell label={c.label} value={c.value} />
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Player detail modal (#528 Phase 2): header + statistics section.
 * Later phases can append position/NBT and session sections here.
 */
export function PlayerDetailModal({ serverName, player, open, onClose }: PlayerDetailModalProps) {
  const uuid = player?.uuid ?? '';
  const { data, isLoading, isError } = usePlayerDetail(serverName, uuid, { enabled: open && !!uuid });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Player Details</DialogTitle>
      <DialogContent>
        {player && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar
              src={player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/64` : undefined}
              alt={player.name}
              sx={{ width: 56, height: 56 }}
            >
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">{player.name}</Typography>
              {player.uuid && (
                <Typography variant="body2" color="text.secondary">
                  {player.uuid}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  label={player.online ? 'Online' : 'Offline'}
                  size="small"
                  color={player.online ? 'success' : 'default'}
                />
                {player.isOp && <Chip label="OP" size="small" color="warning" />}
                {player.isBanned && <Chip label="Banned" size="small" color="error" />}
                {player.isWhitelisted && <Chip label="Whitelisted" size="small" variant="outlined" />}
              </Box>
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          Statistics
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          As last saved by the server.
        </Typography>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {isError && <Alert severity="error">Failed to load player statistics.</Alert>}
        {!isLoading && !isError && <StatisticsSection stats={data?.stats} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
