'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import RouterIcon from '@mui/icons-material/Router';
import { useRouterStatus } from '@/hooks/useMcctl';
import { PlatformInfo, RouterStatus, NetworkSettings, AvahiStatus } from '@/components/settings';

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width="50%" height={32} />
        </Box>
        {[...Array(rows)].map((_, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

function SkeletonRoutingTable() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width="40%" height={32} />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={70} height={24} />
            <Skeleton variant="rounded" width={70} height={24} />
          </Box>
        </Box>
        <Skeleton variant="text" width="30%" sx={{ mt: 3, mb: 1 }} />
        {[0, 1].map((i) => (
          <Box key={i} sx={{ border: 1, borderColor: 'divider', p: 2, '&:not(:last-child)': { borderBottom: 0 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Skeleton variant="circular" width={10} height={10} />
              <Skeleton variant="text" width="25%" />
              <Skeleton variant="text" width="15%" />
              <Skeleton variant="text" width="10%" sx={{ ml: 'auto' }} />
            </Box>
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} variant="text" width="70%" sx={{ ml: 2.5 }} />
            ))}
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export default function RoutingPage() {
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
            <RouterIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Routing
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Server routing and network configuration
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
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <SkeletonCard rows={4} />
              <SkeletonCard rows={4} />
              <SkeletonCard rows={1} />
            </Box>
          </Grid>
          <Grid item xs={12} md={8}>
            <SkeletonRoutingTable />
          </Grid>
        </Grid>
      ) : data?.router ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <PlatformInfo router={data.router} />
              <NetworkSettings router={data.router} />
              <AvahiStatus avahi={data.avahi} />
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
