'use client';

import { useState, ReactNode } from 'react';
import Box from '@mui/material/Box';
import { GNB, GNB_HEIGHT, Footer } from '@/components/layout';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
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
          pt: { xs: `${GNB_HEIGHT + 24}px`, sm: `${GNB_HEIGHT + 32}px` },
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
