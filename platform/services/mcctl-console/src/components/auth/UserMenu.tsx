'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  CircularProgress,
  Button,
  Chip,
} from '@mui/material';
import { Logout, Person } from '@mui/icons-material';
import { useSession, signOut } from '@/lib/auth-client';

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleCloseMenu();
    await signOut();
    router.push('/login');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  // Loading state
  if (isPending) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Not authenticated
  if (!session?.user) {
    return (
      <Button variant="contained" color="primary" onClick={handleLogin}>
        Sign In
      </Button>
    );
  }

  const { user } = session;
  const initials = getInitials(user.name, user.email);

  return (
    <>
      <IconButton onClick={handleOpenMenu} aria-label="user menu">
        <Avatar sx={{ bgcolor: 'primary.main' }}>{initials}</Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{ mt: 1 }}
      >
        <Box sx={{ px: 2, py: 1.5, minWidth: 200 }}>
          <Typography variant="subtitle1" fontWeight="600">
            {user.name || 'User'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
          {user.role === 'admin' && (
            <Chip
              label="Admin"
              size="small"
              color="primary"
              sx={{ mt: 1 }}
            />
          )}
        </Box>

        <Divider />

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
