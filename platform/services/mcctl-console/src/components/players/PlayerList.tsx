/**
 * PlayerList Component
 * Displays online players grouped by server with kick functionality
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';

/**
 * Player type
 */
interface Player {
  name: string;
  uuid: string;
}

/**
 * Server with players
 */
interface ServerPlayers {
  name: string;
  players: Player[];
}

/**
 * API Response type
 */
interface PlayersResponse {
  servers: ServerPlayers[];
}

/**
 * PlayerList component props
 */
interface PlayerListProps {
  /**
   * Callback when player is kicked
   */
  onPlayerKicked?: (player: Player, server: string) => void;
}

/**
 * PlayerList - Display online players by server
 */
export function PlayerList({ onPlayerKicked }: PlayerListProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerPlayers[]>([]);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<{ player: Player; server: string } | null>(null);
  const [kickReason, setKickReason] = useState('');
  const [kicking, setKicking] = useState(false);

  // Fetch players
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/players');
      if (!response.ok) {
        throw new Error('Failed to fetch players');
      }
      const data: PlayersResponse = await response.json();
      setServers(data.servers);
    } catch (err) {
      setError('Failed to load players');
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Handle kick button click
  const handleKickClick = (player: Player, server: string) => {
    setPlayerToKick({ player, server });
    setKickReason('');
    setKickDialogOpen(true);
  };

  // Handle kick confirmation
  const handleKickConfirm = async () => {
    if (!playerToKick) return;

    setKicking(true);

    try {
      const response = await fetch('/api/players/kick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player: playerToKick.player.name,
          server: playerToKick.server,
          reason: kickReason || 'Kicked by administrator',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to kick player');
      }

      // Close dialog and refresh
      setKickDialogOpen(false);
      setPlayerToKick(null);
      onPlayerKicked?.(playerToKick.player, playerToKick.server);
      await fetchPlayers();
    } catch (err) {
      console.error('Error kicking player:', err);
    } finally {
      setKicking(false);
    }
  };

  // Check if any server has players
  const hasPlayers = servers.some((server) => server.players.length > 0);

  return (
    <Card data-testid="player-list">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Online Players</Typography>
          <IconButton onClick={fetchPlayers} disabled={loading} aria-label="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && !hasPlayers && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No players online
          </Typography>
        )}

        {!loading && !error && hasPlayers && (
          <Box>
            {servers.map((server) => (
              <Accordion key={server.name} defaultExpanded={server.players.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      {server.name}
                    </Typography>
                    <Chip
                      label={`${server.players.length} player${server.players.length !== 1 ? 's' : ''}`}
                      size="small"
                      color={server.players.length > 0 ? 'success' : 'default'}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {server.players.length === 0 ? (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No players online on this server
                    </Typography>
                  ) : (
                    <List dense>
                      {server.players.map((player) => (
                        <ListItem
                          key={player.uuid}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              aria-label="Kick player"
                              onClick={() => handleKickClick(player, server.name)}
                              color="error"
                            >
                              <PersonRemoveIcon />
                            </IconButton>
                          }
                        >
                          <ListItemAvatar>
                            <Avatar
                              src={`https://mc-heads.net/avatar/${player.uuid}/40`}
                              alt={player.name}
                            >
                              <PersonIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={player.name}
                            secondary={player.uuid.substring(0, 8) + '...'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* Kick Confirmation Dialog */}
        <Dialog open={kickDialogOpen} onClose={() => setKickDialogOpen(false)}>
          <DialogTitle>Kick Player</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to kick {playerToKick?.player.name} from {playerToKick?.server}?
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label="Reason (optional)"
              fullWidth
              variant="outlined"
              value={kickReason}
              onChange={(e) => setKickReason(e.target.value)}
              placeholder="Kicked by administrator"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setKickDialogOpen(false)} disabled={kicking}>
              Cancel
            </Button>
            <Button
              onClick={handleKickConfirm}
              color="error"
              variant="contained"
              disabled={kicking}
              aria-label="Confirm kick"
            >
              {kicking ? <CircularProgress size={20} /> : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
