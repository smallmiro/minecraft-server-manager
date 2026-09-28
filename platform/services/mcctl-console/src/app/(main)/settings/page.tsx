'use client';

import { useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import SettingsIcon from '@mui/icons-material/Settings';
import { BentoGrid, BentoPanel, PageHero } from '@/components/bento';
import { ProfileSection, PasswordSection, AccountInfoSection } from '@/components/settings';

const embeddedCardSx = {
  height: '100%',
  '& > .MuiCard-root': {
    height: '100%',
    border: 0,
    borderRadius: 0,
    boxShadow: 'none',
    backgroundColor: 'transparent',
  },
};

export default function SettingsPage() {
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSuccess = (message: string) => {
    setSnackbar({ open: true, message, severity: 'success' });
  };

  const handleError = (message: string) => {
    setSnackbar({ open: true, message, severity: 'error' });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <PageHero
        compact
        title="Settings"
        description="Manage your profile, account details, and sign-in security"
        eyebrow="Account"
        icon={<SettingsIcon />}
      />

      <BentoGrid aria-label="Account settings">
        <BentoPanel
          role="region"
          aria-label="Profile settings"
          accent="primary"
          sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 6' } }}
        >
          <ProfileSection onSuccess={handleSuccess} onError={handleError} />
        </BentoPanel>
        <BentoPanel
          role="region"
          aria-label="Account information"
          sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 3', md: 'span 6' } }}
        >
          <AccountInfoSection />
        </BentoPanel>
        <BentoPanel
          role="region"
          aria-label="Password settings"
          accent="warning"
          sx={{ ...embeddedCardSx, gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' } }}
        >
          <PasswordSection onSuccess={handleSuccess} onError={handleError} />
        </BentoPanel>
      </BentoGrid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
