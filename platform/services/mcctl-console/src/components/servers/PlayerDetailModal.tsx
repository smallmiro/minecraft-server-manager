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
import type { PlayerSummary, PlayerStats, PlayerData, LivePosition, SessionHistory } from '@/ports/api/IMcctlApiClient';

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

/** Strip the "minecraft:" namespace prefix for display. */
function stripNamespace(id: string): string {
  return id.replace(/^minecraft:/, '');
}

function PositionStatusSection({
  data,
  livePosition,
}: {
  data: PlayerData | null | undefined;
  livePosition: LivePosition | null | undefined;
}) {
  if (!livePosition && !data) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No player data file.
      </Typography>
    );
  }

  const pos = livePosition ?? data!;
  const dimension = livePosition?.dimension ?? data?.dimension;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" fontWeight={600}>
          {livePosition ? 'Live position' : 'Last saved position'}
        </Typography>
        {livePosition && <Chip label="Live" size="small" color="success" />}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        X: {pos.x.toFixed(1)} Y: {pos.y.toFixed(1)} Z: {pos.z.toFixed(1)}
        {dimension && ` · ${dimension}`}
      </Typography>

      {data && (
        <>
          <Grid container spacing={1.5}>
            <Grid item xs={6} sm={3}>
              <StatCell label="Health" value={data.health != null ? `${data.health}/20` : '—/20'} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCell label="Food" value={data.food != null ? `${data.food}/20` : '—/20'} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCell label="XP Level" value={data.xpLevel != null ? String(data.xpLevel) : '—'} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCell label="Game Mode" value={data.gameMode} />
            </Grid>
          </Grid>

          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Inventory: {data.inventory.slotsUsed} slots used
            </Typography>
            {data.inventory.items.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {data.inventory.items.slice(0, 10).map((item, i) => (
                  <Chip
                    key={`${item.id}-${i}`}
                    size="small"
                    variant="outlined"
                    label={`${stripNamespace(item.id)} x${item.count}`}
                  />
                ))}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

/** Format an ISO timestamp as relative time ("2h ago"), falling back to a date once past a day. */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SessionHistorySection({ sessions }: { sessions: SessionHistory | null | undefined }) {
  if (!sessions || sessions.recent.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No sessions recorded yet (history is collected from server logs).
      </Typography>
    );
  }

  return (
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
        <Grid item xs={6} sm={4}>
          <StatCell label="Visits" value={sessions.visitCount.toLocaleString()} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCell label="Total Playtime" value={formatPlayTime(sessions.totalPlaytimeSeconds)} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCell
            label="Last Seen"
            value={sessions.lastSeen ? formatRelativeTime(sessions.lastSeen) : '—'}
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {sessions.recent.map((s, i) => (
          <Box
            key={`${s.joinedAt}-${i}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.5,
              py: 0.75,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              {new Date(s.joinedAt).toLocaleString()}
              {' → '}
              {s.leftAt ? new Date(s.leftAt).toLocaleString() : ''}
            </Typography>
            {s.leftAt ? (
              <Chip label={formatPlayTime(s.durationSeconds)} size="small" variant="outlined" />
            ) : (
              <Chip label="Online now" size="small" color="success" />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Player detail modal (#528 Phase 2/3/4): header + statistics +
 * position/status + session history.
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

        {!isLoading && !isError && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Position &amp; Status
            </Typography>
            <PositionStatusSection data={data?.data} livePosition={data?.livePosition} />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Session History
            </Typography>
            <SessionHistorySection sessions={data?.sessions} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
