/**
 * WhitelistManager Component
 * Manages server whitelist - toggle, add/remove/bulk-add players, search/filter
 */

'use client';

import { useState, useMemo } from 'react';
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
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import {
  useWhitelist,
  useWhitelistStatus,
  useSetWhitelistStatus,
  useAddToWhitelist,
  useRemoveFromWhitelist,
} from '@/hooks/useMcctl';

interface WhitelistManagerProps {
  serverName: string;
}

export function WhitelistManager({ serverName }: WhitelistManagerProps) {
  const [newPlayer, setNewPlayer] = useState('');
  const [removingPlayer, setRemovingPlayer] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // React Query hooks
  const { data: whitelistData, isLoading, error: fetchError } = useWhitelist(serverName);
  const { data: statusData } = useWhitelistStatus(serverName);
  const setStatusMutation = useSetWhitelistStatus();
  const addMutation = useAddToWhitelist();
  const removeMutation = useRemoveFromWhitelist();

  const players = whitelistData?.players ?? [];
  const source = whitelistData?.source;
  const whitelistEnabled = statusData?.enabled ?? false;

  // Client-side search filter
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const query = searchQuery.toLowerCase();
    return players.filter(p => p.name.toLowerCase().includes(query));
  }, [players, searchQuery]);

  const error = fetchError?.message
    || (addMutation.error ? 'Failed to add player to whitelist' : null)
    || (removeMutation.error && !removingPlayer ? 'Failed to remove player from whitelist' : null)
    || (setStatusMutation.error ? 'Failed to update whitelist status' : null);

  // Toggle whitelist enabled/disabled
  const handleToggle = () => {
    setStatusMutation.mutate({
      serverName,
      enabled: !whitelistEnabled,
    });
  };

  // Add single player
  const handleAdd = () => {
    if (!newPlayer.trim()) return;

    addMutation.mutate(
      { serverName, player: newPlayer.trim() },
      {
        onSuccess: () => setNewPlayer(''),
      }
    );
  };

  // Remove player
  const handleRemove = (playerName: string) => {
    setRemovingPlayer(playerName);
    removeMutation.mutate(
      { serverName, player: playerName },
      {
        onSettled: () => setRemovingPlayer(null),
      }
    );
  };

  // Bulk add players
  const handleBulkAdd = async () => {
    const names = bulkInput
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    setBulkResult(null);
    let successCount = 0;

    for (const name of names) {
      try {
        await addMutation.mutateAsync({ serverName, player: name });
        successCount++;
      } catch {
        // continue with next player
      }
    }

    setBulkResult(`Added ${successCount} of ${names.length} players`);
    if (successCount > 0) {
      setBulkInput('');
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const isAdding = addMutation.isPending;

  return (
    <Card data-testid="whitelist-manager">
      <CardContent>
        {/* Header with toggle */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">Whitelist</Typography>
            <Chip
              label={whitelistEnabled ? 'ON' : 'OFF'}
              color={whitelistEnabled ? 'success' : 'default'}
              size="small"
              data-testid="whitelist-status-chip"
            />
          </Stack>
          <Switch
            checked={whitelistEnabled}
            onChange={handleToggle}
            disabled={setStatusMutation.isPending}
            inputProps={{ 'aria-label': 'Toggle whitelist' }}
            data-testid="whitelist-toggle"
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!isLoading && source && source !== 'rcon' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Server is offline. Showing data from {source === 'config' ? 'config.env' : 'whitelist.json'}. Changes will apply on next server start.
          </Alert>
        )}

        {/* Add Player Form */}
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
          {bulkMode ? (
            <Box sx={{ flex: 1 }}>
              <TextField
                size="small"
                placeholder="player1, player2, player3"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                disabled={isAdding}
                fullWidth
                multiline
                rows={3}
                data-testid="bulk-input"
              />
              {bulkResult && (
                <Alert severity="info" sx={{ mt: 1 }} data-testid="bulk-result">
                  {bulkResult}
                </Alert>
              )}
            </Box>
          ) : (
            <TextField
              size="small"
              placeholder="Player name"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAdding}
              fullWidth
            />
          )}
          {bulkMode ? (
            <Button
              variant="contained"
              onClick={handleBulkAdd}
              disabled={!bulkInput.trim() || isAdding}
              startIcon={isAdding ? <CircularProgress size={16} /> : <GroupAddIcon />}
              aria-label="Add players in bulk"
            >
              Add All
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!newPlayer.trim() || isAdding}
              startIcon={isAdding ? <CircularProgress size={16} /> : <PersonAddIcon />}
              aria-label="Add player to whitelist"
            >
              Add
            </Button>
          )}
          <Button
            variant={bulkMode ? 'contained' : 'outlined'}
            onClick={() => {
              setBulkMode(!bulkMode);
              setBulkResult(null);
            }}
            aria-label="Toggle bulk mode"
            data-testid="bulk-toggle"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Bulk
          </Button>
        </Stack>

        {/* Search filter (shown when 5+ players) */}
        {players.length >= 5 && (
          <TextField
            size="small"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            data-testid="search-input"
          />
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && players.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No players whitelisted
          </Typography>
        )}

        {!isLoading && players.length > 0 && filteredPlayers.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }} data-testid="no-match-message">
            No matching players
          </Typography>
        )}

        {!isLoading && filteredPlayers.length > 0 && (
          <List dense>
            {filteredPlayers.map((player) => (
              <ListItem
                key={player.uuid || player.name}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Remove from whitelist"
                    onClick={() => handleRemove(player.name)}
                    disabled={removingPlayer === player.name}
                    color="error"
                  >
                    {removingPlayer === player.name ? (
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
