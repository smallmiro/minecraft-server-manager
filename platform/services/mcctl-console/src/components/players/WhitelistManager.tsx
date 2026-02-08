/**
 * WhitelistManager Component
 * Manages server whitelist - add/remove players
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
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';

/**
 * Player type
 */
interface Player {
  name: string;
  uuid: string;
}

/**
 * API Response type
 */
interface WhitelistResponse {
  players: Player[];
  source?: 'rcon' | 'file' | 'config';
}

/**
 * WhitelistManager props
 */
interface WhitelistManagerProps {
  /**
   * Server name to manage whitelist for
   */
  serverName: string;
}

/**
 * WhitelistManager - Add/remove players from whitelist
 */
export function WhitelistManager({ serverName }: WhitelistManagerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [source, setSource] = useState<'rcon' | 'file' | 'config' | undefined>();
  const [newPlayer, setNewPlayer] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Fetch whitelist
  const fetchWhitelist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/players/whitelist?server=${encodeURIComponent(serverName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch whitelist');
      }
      const data: WhitelistResponse = await response.json();
      setPlayers(data.players);
      setSource(data.source);
    } catch (err) {
      setError('Failed to load whitelist');
      console.error('Error fetching whitelist:', err);
    } finally {
      setLoading(false);
    }
  }, [serverName]);

  useEffect(() => {
    fetchWhitelist();
  }, [fetchWhitelist]);

  // Add player to whitelist
  const handleAdd = async () => {
    if (!newPlayer.trim()) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/players/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player: newPlayer.trim(),
          server: serverName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add player');
      }

      setNewPlayer('');
      await fetchWhitelist();
    } catch (err) {
      setError('Failed to add player to whitelist');
      console.error('Error adding player:', err);
    } finally {
      setAdding(false);
    }
  };

  // Remove player from whitelist
  const handleRemove = async (playerName: string) => {
    setRemoving(playerName);
    setError(null);

    try {
      const response = await fetch(
        `/api/players/whitelist?player=${encodeURIComponent(playerName)}&server=${encodeURIComponent(serverName)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove player');
      }

      await fetchWhitelist();
    } catch (err) {
      setError('Failed to remove player from whitelist');
      console.error('Error removing player:', err);
    } finally {
      setRemoving(null);
    }
  };

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <Card data-testid="whitelist-manager">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Whitelist
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && source && source !== 'rcon' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Server is offline. Showing data from {source === 'config' ? 'config.env' : 'whitelist.json'}. Changes will apply on next server start.
          </Alert>
        )}

        {/* Add Player Form */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Player name"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={adding}
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newPlayer.trim() || adding}
            startIcon={adding ? <CircularProgress size={16} /> : <PersonAddIcon />}
            aria-label="Add player to whitelist"
          >
            Add
          </Button>
        </Stack>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && players.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No players whitelisted
          </Typography>
        )}

        {!loading && players.length > 0 && (
          <List dense>
            {players.map((player) => (
              <ListItem
                key={player.uuid || player.name}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Remove from whitelist"
                    onClick={() => handleRemove(player.name)}
                    disabled={removing === player.name}
                    color="error"
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
                  >
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={player.name}
                  secondary={player.uuid ? player.uuid.substring(0, 8) + '...' : 'UUID not available'}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
