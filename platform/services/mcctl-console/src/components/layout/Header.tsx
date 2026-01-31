'use client';

import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { SIDEBAR_WIDTH } from './Sidebar';

interface HeaderProps {
  title?: string;
  onMenuClick: () => void;
}

export function Header({ title = 'Dashboard', onMenuClick }: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    handleUserMenuClose();
    // TODO: Navigate to profile
  };

  const handleLogout = () => {
    handleUserMenuClose();
    // TODO: Implement logout
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        ml: { lg: `${SIDEBAR_WIDTH}px` },
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        {/* Menu Button (Mobile Only) */}
        <IconButton
          color="inherit"
          aria-label="open sidebar"
          edge="start"
          onClick={onMenuClick}
          sx={{
            mr: 2,
            display: { lg: 'none' },
          }}
        >
          <MenuIcon />
        </IconButton>

        {/* Page Title */}
        <Typography
          variant="h6"
          component="h1"
          sx={{
            flexGrow: 1,
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>

        {/* User Menu */}
        <Box>
          <IconButton
            onClick={handleUserMenuClick}
            aria-label="user menu"
            aria-controls={open ? 'user-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              <AccountCircleIcon />
            </Avatar>
          </IconButton>
          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleUserMenuClose}
            MenuListProps={{
              'aria-labelledby': 'user-menu-button',
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleProfile}>Profile</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
