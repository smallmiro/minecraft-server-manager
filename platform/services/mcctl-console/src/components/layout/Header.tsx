'use client';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import MenuIcon from '@mui/icons-material/Menu';
import { SIDEBAR_WIDTH } from './Sidebar';
import { UserMenu } from '@/components/auth';

interface HeaderProps {
  title?: string;
  onMenuClick: () => void;
}

export function Header({ title = 'Dashboard', onMenuClick }: HeaderProps) {
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
          <UserMenu />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
