'use client';

import { useState, ReactNode } from 'react';
import Box from '@mui/material/Box';
import { GNB, GNB_HEIGHT } from './GNB';
import { Footer } from './Footer';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenuToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      {/* Global Navigation Bar */}
      <GNB mobileOpen={mobileOpen} onMenuToggle={handleMenuToggle} />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          // The AppBar grows by env(safe-area-inset-top) in PWA standalone mode
          // (#480); add the same inset here so content clears the AppBar instead
          // of being hidden under it.
          pt: {
            xs: `calc(${GNB_HEIGHT + 24}px + env(safe-area-inset-top))`,
            sm: `calc(${GNB_HEIGHT + 32}px + env(safe-area-inset-top))`,
          },
          pb: { xs: 3, sm: 4 },
          px: { xs: 2, sm: 3, md: 4 },
          maxWidth: '1400px',
          width: '100%',
          mx: 'auto',
        }}
      >
        {children}
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
}
