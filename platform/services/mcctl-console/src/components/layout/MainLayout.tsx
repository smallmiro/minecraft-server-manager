'use client';

import { useState, ReactNode } from 'react';
import Box from '@mui/material/Box';
import { Sidebar, SIDEBAR_WIDTH } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
}

export function MainLayout({ children, title = 'Dashboard' }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { lg: SIDEBAR_WIDTH },
          flexShrink: { lg: 0 },
        }}
      >
        <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        }}
      >
        {/* Header */}
        <Header title={title} onMenuClick={handleDrawerToggle} />

        {/* Page Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            mt: '64px', // AppBar height
            backgroundColor: 'background.default',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
