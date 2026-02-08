/**
 * BanManager Component
 * Manages server bans - add/remove banned players
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
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import PersonIcon from '@mui/icons-material/Person';

/**
 * Banned player type
 */
interface BannedPlayer {
  name: string;
  uuid: string;
  reason: string;
  created: string;
  source: string;
}

/**
 * API Response type
 */
interface BanListResponse {
  players: BannedPlayer[];
  source?: 'rcon' | 'file' | 'config';
}

/**
 * BanManager props
 */
interface BanManagerProps {
  /**
   * Server name to manage bans for
   */
  serverName: string;
}

/**
 * BanManager - Add/remove banned players
 */
export function BanManager({ serverName }: BanManagerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayer[]>([]);
  const [dataSource, setDataSource] = useState<'rcon' | 'file' | 'config' | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBan, setNewBan] = useState({ player: '', reason: '' });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Fetch banned players
  const fetchBans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/players/ban?server=${encodeURIComponent(serverName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bans');
      }
      const data: BanListResponse = await response.json();
      setBannedPlayers(data.players);
      setDataSource(data.source);
    } catch (err) {
      setError('Failed to load ban list');
      console.error('Error fetching bans:', err);
    } finally {
      setLoading(false);
    }
  }, [serverName]);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  // Open ban dialog
  const handleOpenDialog = () => {
    setNewBan({ player: '', reason: '' });
    setDialogOpen(true);
  };

  // Close ban dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setNewBan({ player: '', reason: '' });
  };

  // Add ban
  const handleAdd = async () => {
    if (!newBan.player.trim()) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/players/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player: newBan.player.trim(),
          reason: newBan.reason.trim() || 'Banned by administrator',
          server: serverName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to ban player');
      }

      handleCloseDialog();
      await fetchBans();
    } catch (err) {
      setError('Failed to ban player');
      console.error('Error banning player:', err);
    } finally {
      setAdding(false);
    }
  };

  // Remove ban (unban)
  const handleRemove = async (playerName: string) => {
    setRemoving(playerName);
    setError(null);

    try {
      const response = await fetch(
        `/api/players/ban?player=${encodeURIComponent(playerName)}&server=${encodeURIComponent(serverName)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unban player');
      }

      await fetchBans();
    } catch (err) {
      setError('Failed to unban player');
      console.error('Error unbanning player:', err);
    } finally {
      setRemoving(null);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Card data-testid="ban-manager">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Ban List</Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<BlockIcon />}
            onClick={handleOpenDialog}
            aria-label="Ban player"
          >
            Ban Player
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && dataSource && dataSource !== 'rcon' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Server is offline. Showing data from {dataSource === 'config' ? 'config.env' : 'banned-players.json'}. Changes will apply on next server start.
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && bannedPlayers.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No players banned
          </Typography>
        )}

        {!loading && bannedPlayers.length > 0 && (
          <List dense>
            {bannedPlayers.map((player) => (
              <ListItem
                key={player.uuid || player.name}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Unban player"
                    onClick={() => handleRemove(player.name)}
                    disabled={removing === player.name}
                    color="success"
                  >
                    {removing === player.name ? (
                      <CircularProgress size={20} />
                    ) : (
                      <DeleteIcon />
                    )}
                  </IconButton>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    src={player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/40` : undefined}
                    alt={player.name}
                    sx={{ bgcolor: 'error.main' }}
                  >
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={player.name}
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.secondary">
                        Reason: {player.reason || 'No reason specified'}
                      </Typography>
                      <br />
                      <Typography component="span" variant="caption" color="text.secondary">
                        Banned: {formatDate(player.created)} by {player.source || 'Unknown'}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* Ban Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Ban Player</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Player Name"
                placeholder="Enter player name"
                value={newBan.player}
                onChange={(e) => setNewBan({ ...newBan, player: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Reason"
                placeholder="Banned by administrator"
                value={newBan.reason}
                onChange={(e) => setNewBan({ ...newBan, reason: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={adding}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              color="error"
              variant="contained"
              disabled={!newBan.player.trim() || adding}
              startIcon={adding ? <CircularProgress size={16} /> : <BlockIcon />}
            >
              Ban
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
