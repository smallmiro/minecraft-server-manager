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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import { OpLevelBadge } from './OpLevelBadge';
import { OpLevelSelector } from './OpLevelSelector';

/**
 * Operator type (matches API response)
 */
interface Operator {
  name: string;
  uuid: string;
  level: number;
  role: string;
  bypassesPlayerLimit: boolean;
}

/**
 * API Response type
 */
interface OpListResponse {
  operators: Operator[];
  count: number;
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

  // Add operator dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(4);

  // Change level dialog state
  const [changeLevelDialogOpen, setChangeLevelDialogOpen] = useState(false);
  const [changingOperator, setChangingOperator] = useState<Operator | null>(null);
  const [newLevel, setNewLevel] = useState<1 | 2 | 3 | 4>(4);
  const [changingLevel, setChangingLevel] = useState(false);

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuOperator, setMenuOperator] = useState<Operator | null>(null);

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

  // Add operator with level
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
          level: selectedLevel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add operator');
      }

      setNewOp('');
      setSelectedLevel(4);
      setAddDialogOpen(false);
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
    setAnchorEl(null);
    setMenuOperator(null);

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

  // Change operator level
  const handleChangeLevel = async () => {
    if (!changingOperator) return;

    setChangingLevel(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/players/op/${encodeURIComponent(changingOperator.name)}?server=${encodeURIComponent(serverName)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level: newLevel,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to change operator level');
      }

      setChangeLevelDialogOpen(false);
      setChangingOperator(null);
      await fetchOperators();
    } catch (err) {
      setError('Failed to change operator level');
      console.error('Error changing operator level:', err);
    } finally {
      setChangingLevel(false);
    }
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, operator: Operator) => {
    setAnchorEl(event.currentTarget);
    setMenuOperator(operator);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuOperator(null);
  };

  const handleOpenChangeLevelDialog = () => {
    if (menuOperator) {
      setChangingOperator(menuOperator);
      setNewLevel(menuOperator.level as 1 | 2 | 3 | 4);
      setChangeLevelDialogOpen(true);
      handleMenuClose();
    }
  };

  // Handle Enter key (quick add without dialog)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setAddDialogOpen(true);
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

        {/* Add Operator Button */}
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            onClick={() => setAddDialogOpen(true)}
            startIcon={<PersonAddIcon />}
            aria-label="Add operator"
            fullWidth
          >
            Add Operator
          </Button>
        </Box>

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
          <>
            <List dense>
              {operators.map((op) => (
                <ListItem
                  key={op.uuid || op.name}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="Operator actions"
                      onClick={(e) => handleMenuOpen(e, op)}
                      disabled={removing === op.name}
                    >
                      {removing === op.name ? (
                        <CircularProgress size={20} />
                      ) : (
                        <MoreVertIcon />
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography component="span">{op.name}</Typography>
                        <OpLevelBadge level={op.level as 1 | 2 | 3 | 4} showIcon size="small" />
                      </Box>
                    }
                    secondary={op.uuid ? op.uuid.substring(0, 8) + '...' : 'UUID not available'}
                  />
                </ListItem>
              ))}
            </List>

            {/* Action Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleOpenChangeLevelDialog}>
                <EditIcon sx={{ mr: 1 }} fontSize="small" />
                Change Level
              </MenuItem>
              <MenuItem onClick={() => menuOperator && handleRemove(menuOperator.name)}>
                <DeleteIcon sx={{ mr: 1 }} fontSize="small" color="error" />
                Remove OP
              </MenuItem>
            </Menu>
          </>
        )}
      </CardContent>

      {/* Add Operator Dialog */}
      <Dialog open={addDialogOpen} onClose={() => !adding && setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Operator</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Player Name"
            placeholder="Enter player name"
            fullWidth
            value={newOp}
            onChange={(e) => setNewOp(e.target.value)}
            disabled={adding}
            sx={{ mb: 2 }}
          />
          <OpLevelSelector
            value={selectedLevel}
            onChange={setSelectedLevel}
            label="OP Level"
            disabled={adding}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={adding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newOp.trim() || adding}
            startIcon={adding ? <CircularProgress size={16} /> : undefined}
          >
            {adding ? 'Adding...' : 'Add OP'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Level Dialog */}
      <Dialog
        open={changeLevelDialogOpen}
        onClose={() => !changingLevel && setChangeLevelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Change OP Level - {changingOperator?.name}
        </DialogTitle>
        <DialogContent>
          {changingOperator && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current: Level {changingOperator.level} ({changingOperator.role})
              </Typography>
              <OpLevelSelector
                value={newLevel}
                onChange={setNewLevel}
                label="New Level"
                disabled={changingLevel}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeLevelDialogOpen(false)} disabled={changingLevel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleChangeLevel}
            disabled={changingLevel || newLevel === changingOperator?.level}
            startIcon={changingLevel ? <CircularProgress size={16} /> : undefined}
          >
            {changingLevel ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
