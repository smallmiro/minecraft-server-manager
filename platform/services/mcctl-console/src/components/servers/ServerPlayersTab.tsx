'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useServerPlayers } from '@/hooks/useServerPlayers';
import { useAddToWhitelist, useRemoveFromWhitelist } from '@/hooks/useMcctl';
import { PlayerDetailModal } from './PlayerDetailModal';
import type { PlayerSummary } from '@/ports/api/IMcctlApiClient';

export interface ServerPlayersTabProps {
  serverName: string;
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Never';
  try {
    return new Date(lastSeen).toLocaleString();
  } catch {
    return lastSeen;
  }
}

/**
 * "Players" tab content for the server detail view (#528).
 * Unified online+offline roster with kick/ban/op/whitelist management.
 */
export function ServerPlayersTab({ serverName }: ServerPlayersTabProps) {
  const { roster, online, max, isConnected } = useServerPlayers({ serverName });
  const addToWhitelist = useAddToWhitelist();
  const removeFromWhitelist = useRemoveFromWhitelist();

  const [error, setError] = useState<string | null>(null);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<PlayerSummary | null>(null);

  // Captured separately from menuTarget: opening a dialog closes the menu
  // (which clears menuTarget), but the dialog still needs to know who it's for.
  const [dialogTarget, setDialogTarget] = useState<PlayerSummary | null>(null);

  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [kickReason, setKickReason] = useState('');
  const [kicking, setKicking] = useState(false);

  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, player: PlayerSummary) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(player);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  const runAction = async (uuidOrName: string, action: () => Promise<Response>) => {
    setError(null);
    setPendingUuid(uuidOrName);
    try {
      const res = await action();
      if (!res.ok) throw new Error('Action failed');
    } catch {
      setError('Action failed. Please try again.');
    } finally {
      setPendingUuid(null);
    }
  };

  const handleOpenDetail = () => {
    setDialogTarget(menuTarget);
    setDetailOpen(true);
    handleMenuClose();
  };

  const handleOpenKick = () => {
    setDialogTarget(menuTarget);
    setKickReason('');
    setKickDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmKick = async () => {
    if (!dialogTarget) return;
    const player = dialogTarget;
    setKicking(true);
    const body: Record<string, string> = { player: player.name, server: serverName };
    if (kickReason.trim()) body.reason = kickReason.trim();
    await runAction(player.uuid || player.name, () =>
      fetch('/api/players/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    setKicking(false);
    setKickDialogOpen(false);
  };

  const handleOpenBan = () => {
    setDialogTarget(menuTarget);
    setBanReason('');
    setBanDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmBan = async () => {
    if (!dialogTarget) return;
    const player = dialogTarget;
    setBanning(true);
    await runAction(player.uuid || player.name, () =>
      fetch('/api/players/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: player.name,
          server: serverName,
          reason: banReason.trim() || 'Banned by administrator',
        }),
      })
    );
    setBanning(false);
    setBanDialogOpen(false);
  };

  const handleUnban = (player: PlayerSummary) => {
    handleMenuClose();
    runAction(player.uuid || player.name, () =>
      fetch(
        `/api/players/ban?player=${encodeURIComponent(player.name)}&server=${encodeURIComponent(serverName)}`,
        { method: 'DELETE' }
      )
    );
  };

  const handleMakeOp = (player: PlayerSummary) => {
    handleMenuClose();
    runAction(player.uuid || player.name, () =>
      fetch('/api/players/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: player.name, server: serverName, level: 4 }),
      })
    );
  };

  const handleRemoveOp = (player: PlayerSummary) => {
    handleMenuClose();
    runAction(player.uuid || player.name, () =>
      fetch(
        `/api/players/op?player=${encodeURIComponent(player.name)}&server=${encodeURIComponent(serverName)}`,
        { method: 'DELETE' }
      )
    );
  };

  const handleAddWhitelist = (player: PlayerSummary) => {
    handleMenuClose();
    addToWhitelist.mutate({ serverName, player: player.name });
  };

  const handleRemoveWhitelist = (player: PlayerSummary) => {
    handleMenuClose();
    removeFromWhitelist.mutate({ serverName, player: player.name });
  };

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Players
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={`${online} / ${max}`} size="small" />
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: isConnected ? 'primary.main' : 'text.disabled',
              }}
              aria-label={isConnected ? 'Live' : 'Disconnected'}
            />
          </Box>
        </Box>
        <Divider sx={{ mb: 1 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {roster.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No players found for this server yet.
            </Typography>
          </Box>
        ) : (
          <List dense>
            {roster.map((player) => (
              <ListItem
                key={player.uuid || player.name}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Player actions"
                    onClick={(e) => handleMenuOpen(e, player)}
                    disabled={pendingUuid === (player.uuid || player.name)}
                  >
                    {pendingUuid === (player.uuid || player.name) ? (
                      <CircularProgress size={20} />
                    ) : (
                      <MoreVertIcon />
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
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="span">{player.name}</Typography>
                      <Chip
                        label={player.online ? 'Online' : 'Offline'}
                        size="small"
                        color={player.online ? 'success' : 'default'}
                      />
                      {player.isOp && <Chip label="OP" size="small" color="warning" />}
                      {player.isBanned && <Chip label="Banned" size="small" color="error" />}
                      {player.isWhitelisted && <Chip label="Whitelisted" size="small" variant="outlined" />}
                    </Box>
                  }
                  secondary={
                    player.online
                      ? undefined
                      : `Last saved: ${formatLastSeen(player.lastSeen)}`
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* Action Menu */}
        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
          {menuTarget && (
            <MenuItem onClick={handleOpenDetail} disabled={!menuTarget.uuid}>
              <InfoOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              Details
            </MenuItem>
          )}
          {menuTarget?.online && (
            <MenuItem onClick={handleOpenKick}>
              <PersonRemoveIcon fontSize="small" sx={{ mr: 1 }} />
              Kick
            </MenuItem>
          )}
          {menuTarget && !menuTarget.isBanned && (
            <MenuItem onClick={handleOpenBan}>
              <BlockIcon fontSize="small" sx={{ mr: 1 }} color="error" />
              Ban
            </MenuItem>
          )}
          {menuTarget?.isBanned && (
            <MenuItem onClick={() => handleUnban(menuTarget)}>
              <BlockIcon fontSize="small" sx={{ mr: 1 }} />
              Unban
            </MenuItem>
          )}
          {menuTarget && !menuTarget.isOp && (
            <MenuItem onClick={() => handleMakeOp(menuTarget)}>
              <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 1 }} />
              Make OP
            </MenuItem>
          )}
          {menuTarget?.isOp && (
            <MenuItem onClick={() => handleRemoveOp(menuTarget)}>
              <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 1 }} />
              Remove OP
            </MenuItem>
          )}
          {menuTarget && !menuTarget.isWhitelisted && (
            <MenuItem onClick={() => handleAddWhitelist(menuTarget)}>
              <PlaylistAddCheckIcon fontSize="small" sx={{ mr: 1 }} />
              Add to Whitelist
            </MenuItem>
          )}
          {menuTarget?.isWhitelisted && (
            <MenuItem onClick={() => handleRemoveWhitelist(menuTarget)}>
              <PlaylistAddCheckIcon fontSize="small" sx={{ mr: 1 }} />
              Remove from Whitelist
            </MenuItem>
          )}
        </Menu>

        {/* Kick Confirmation Dialog */}
        <Dialog open={kickDialogOpen} onClose={() => !kicking && setKickDialogOpen(false)}>
          <DialogTitle>Kick Player</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to kick {dialogTarget?.name}?
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label="Reason (optional)"
              fullWidth
              value={kickReason}
              onChange={(e) => setKickReason(e.target.value)}
              disabled={kicking}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setKickDialogOpen(false)} disabled={kicking}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmKick}
              color="error"
              variant="contained"
              disabled={kicking}
              aria-label="Confirm kick"
            >
              {kicking ? <CircularProgress size={20} /> : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Ban Confirmation Dialog */}
        <Dialog open={banDialogOpen} onClose={() => !banning && setBanDialogOpen(false)}>
          <DialogTitle>Ban Player</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to ban {dialogTarget?.name}? This action can be reversed later.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label="Reason"
              placeholder="Banned by administrator"
              fullWidth
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              disabled={banning}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBanDialogOpen(false)} disabled={banning}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBan}
              color="error"
              variant="contained"
              disabled={banning}
              aria-label="Confirm ban"
            >
              {banning ? <CircularProgress size={20} /> : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>

        <PlayerDetailModal
          serverName={serverName}
          player={dialogTarget}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      </CardContent>
    </Card>
  );
}
