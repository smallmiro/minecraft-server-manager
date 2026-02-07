'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import { useRouterStatus } from '@/hooks/useMcctl';
import { PlatformInfo, RouterStatus, NetworkSettings } from '@/components/settings';

export default function SettingsPage() {
  const { data, isLoading, error } = useRouterStatus();

  return (
    <>
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <SettingsIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Settings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Platform configuration and router status
            </Typography>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load router status: {error.message}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : data?.router ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <PlatformInfo router={data.router} />
              <NetworkSettings router={data.router} />
            </Box>
          </Grid>
          <Grid item xs={12} md={8}>
            <RouterStatus router={data.router} />
          </Grid>
        </Grid>
      ) : null}
    </>
  );
}
