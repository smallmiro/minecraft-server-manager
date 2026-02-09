'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SettingsIcon from '@mui/icons-material/Settings';
import { ProfileSection, PasswordSection, AccountInfoSection } from '@/components/settings';

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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <SettingsIcon sx={{ fontSize: 32 }} color="primary" />
        <Typography variant="h4" component="h1" fontWeight="bold">
          Settings
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 700 }}>
        <ProfileSection onSuccess={handleSuccess} onError={handleError} />
        <PasswordSection onSuccess={handleSuccess} onError={handleError} />
        <AccountInfoSection />
      </Box>

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
    </Box>
  );
}
