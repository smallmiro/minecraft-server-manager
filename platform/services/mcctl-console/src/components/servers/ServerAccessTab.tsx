'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BuildIcon from '@mui/icons-material/Build';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { PermissionBadge } from '@/components/users/PermissionBadge';
import { ServerAccessDialog } from '@/components/users/ServerAccessDialog';
import {
  useServerUsers,
  useUpdatePermission,
  useRevokeAccess,
} from '@/hooks/useUserServers';
import type { UserServerEntry } from '@/hooks/useUserServers';

interface ServerAccessTabProps {
  serverId: string;
}

export function ServerAccessTab({ serverId }: ServerAccessTabProps) {
  const { data, isLoading, error } = useServerUsers(serverId);
  const updatePermission = useUpdatePermission();
  const revokeAccess = useRevokeAccess();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<UserServerEntry | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, entry: UserServerEntry) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(entry);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  const handleChangePermission = (permission: 'view' | 'manage' | 'admin') => {
    if (!menuTarget || menuTarget.permission === permission) {
      handleMenuClose();
      return;
    }
    updatePermission.mutate(
      { id: menuTarget.id, permission },
      { onSettled: handleMenuClose }
    );
  };

  const handleRevoke = () => {
    if (!menuTarget) return;
    revokeAccess.mutate(menuTarget.id, { onSettled: handleMenuClose });
  };

  const adminCount = data?.users.filter((u) => u.permission === 'admin').length ?? 0;
  const isLastAdmin = menuTarget?.permission === 'admin' && adminCount <= 1;

  if (isLoading) {
    return (
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="text" width="30%" height={32} />
            <Skeleton variant="rounded" width={120} height={36} sx={{ borderRadius: 2 }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="60%" />
              </Box>
              <Skeleton variant="rounded" width={80} height={28} sx={{ borderRadius: 10 }} />
              <Skeleton variant="circular" width={32} height={32} />
            </Box>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load access list: {error.message}
      </Alert>
    );
  }

  const users = data?.users ?? [];

  return (
    <>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Server Access
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ borderRadius: 2 }}
            >
              Add User
            </Button>
          </Box>
          <Divider sx={{ mb: 1 }} />

          {users.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No users have been granted access to this server yet.
              </Typography>
            </Box>
          ) : (
            users.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  py: 1.5,
                  '&:not(:last-child)': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              >
                <Avatar
                  src={entry.user?.image ?? undefined}
                  sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: 16 }}
                >
                  {(entry.user?.name?.[0] || entry.user?.email?.[0] || '?').toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {entry.user?.name || 'Unknown User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {entry.user?.email || entry.userId}
                  </Typography>
                </Box>
                <PermissionBadge permission={entry.permission} size="small" />
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, entry)}
                  sx={{ color: 'text.secondary' }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            ))
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, pt: 1 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              Only platform admins and server owners can manage access.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Permission Change Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableScrollLock
      >
        <MenuItem
          onClick={() => handleChangePermission('admin')}
          disabled={menuTarget?.permission === 'admin'}
        >
          <ListItemIcon>
            <AdminPanelSettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change to Owner</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleChangePermission('manage')}
          disabled={menuTarget?.permission === 'manage' || isLastAdmin}
        >
          <ListItemIcon>
            <BuildIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change to Operator</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => handleChangePermission('view')}
          disabled={menuTarget?.permission === 'view' || isLastAdmin}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change to Viewer</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleRevoke}
          disabled={isLastAdmin}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <PersonRemoveIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Remove Access</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add User Dialog */}
      <ServerAccessDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        serverId={serverId}
      />
    </>
  );
}
