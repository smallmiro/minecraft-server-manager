/**
 * OpManager Component
 * Manages server operators - add/remove OPs
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
import Chip from '@mui/material/Chip';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

/**
 * Operator type
 */
interface Operator {
  name: string;
  uuid: string;
  level: number;
}

/**
 * API Response type
 */
interface OpListResponse {
  operators: Operator[];
  source?: 'rcon' | 'file' | 'config';
}

/**
 * OpManager props
 */
interface OpManagerProps {
  /**
   * Server name to manage operators for
   */
  serverName: string;
}

/**
 * OpManager - Add/remove operators
 */
export function OpManager({ serverName }: OpManagerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [source, setSource] = useState<'rcon' | 'file' | 'config' | undefined>();
  const [newOp, setNewOp] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Fetch operators
  const fetchOperators = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/players/op?server=${encodeURIComponent(serverName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch operators');
      }
      const data: OpListResponse = await response.json();
      setOperators(data.operators);
      setSource(data.source);
    } catch (err) {
      setError('Failed to load operators');
      console.error('Error fetching operators:', err);
    } finally {
      setLoading(false);
    }
  }, [serverName]);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  // Add operator
  const handleAdd = async () => {
    if (!newOp.trim()) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/players/op', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player: newOp.trim(),
          server: serverName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add operator');
      }

      setNewOp('');
      await fetchOperators();
    } catch (err) {
      setError('Failed to add operator');
      console.error('Error adding operator:', err);
    } finally {
      setAdding(false);
    }
  };

  // Remove operator
  const handleRemove = async (playerName: string) => {
    setRemoving(playerName);
    setError(null);

    try {
      const response = await fetch(
        `/api/players/op?player=${encodeURIComponent(playerName)}&server=${encodeURIComponent(serverName)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove operator');
      }

      await fetchOperators();
    } catch (err) {
      setError('Failed to remove operator');
      console.error('Error removing operator:', err);
    } finally {
      setRemoving(null);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  // Get level color
  const getLevelColor = (level: number): 'default' | 'primary' | 'secondary' | 'error' => {
    switch (level) {
      case 4:
        return 'error';
      case 3:
        return 'secondary';
      case 2:
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Card data-testid="op-manager">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Operators
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && source && source !== 'rcon' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Server is offline. Showing data from {source === 'config' ? 'config.env' : 'ops.json'}. Changes will apply on next server start.
          </Alert>
        )}

        {/* Add Operator Form */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Player name"
            value={newOp}
            onChange={(e) => setNewOp(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={adding}
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newOp.trim() || adding}
            startIcon={adding ? <CircularProgress size={16} /> : <PersonAddIcon />}
            aria-label="Add operator"
          >
            Add
          </Button>
        </Stack>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && operators.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No operators configured
          </Typography>
        )}

        {!loading && operators.length > 0 && (
          <List dense>
            {operators.map((op) => (
              <ListItem
                key={op.uuid || op.name}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Remove operator"
                    onClick={() => handleRemove(op.name)}
                    disabled={removing === op.name}
                    color="error"
                  >
                    {removing === op.name ? (
                      <CircularProgress size={20} />
                    ) : (
                      <DeleteIcon />
                    )}
                  </IconButton>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    src={op.uuid ? `https://mc-heads.net/avatar/${op.uuid}/40` : undefined}
                    alt={op.name}
                    sx={{ bgcolor: 'warning.main' }}
                  >
                    <AdminPanelSettingsIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {op.name}
                      <Chip
                        label={`Level ${op.level}`}
                        size="small"
                        color={getLevelColor(op.level)}
                      />
                    </Box>
                  }
                  secondary={op.uuid ? op.uuid.substring(0, 8) + '...' : 'UUID not available'}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
