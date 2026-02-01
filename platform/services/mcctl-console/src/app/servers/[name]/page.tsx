'use client';

import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { MainLayout } from '@/components/layout/MainLayout';
import { ServerDetail } from '@/components/servers/ServerDetail';
import {
  useServer,
  useStartServer,
  useStopServer,
  useRestartServer,
} from '@/hooks/useMcctl';

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverName = decodeURIComponent(params.name as string);

  // Fetch server detail
  const { data, isLoading, error } = useServer(serverName);

  // Mutations
  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();

  const handleStartServer = async () => {
    try {
      await startServer.mutateAsync(serverName);
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  };

  const handleStopServer = async () => {
    try {
      await stopServer.mutateAsync(serverName);
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  const handleRestartServer = async () => {
    try {
      await restartServer.mutateAsync(serverName);
    } catch (err) {
      console.error('Failed to restart server:', err);
    }
  };

  const isRunning = data?.server.status === 'running';
  const isStopped =
    data?.server.status === 'stopped' || data?.server.status === 'exited';

  const isActionPending =
    startServer.isPending || stopServer.isPending || restartServer.isPending;

  return (
    <MainLayout title={serverName}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => router.push('/servers')}
          sx={{ cursor: 'pointer' }}
        >
          Servers
        </Link>
        <Typography variant="body2" color="text.primary">
          {serverName}
        </Typography>
      </Breadcrumbs>

      {/* Header with actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => router.push('/servers')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1">
            {serverName}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {isStopped && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartServer}
              disabled={isActionPending}
            >
              Start
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={handleRestartServer}
                disabled={isActionPending}
              >
                Restart
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleStopServer}
                disabled={isActionPending}
              >
                Stop
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Error messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load server: {error.message}
        </Alert>
      )}

      {startServer.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to start server: {startServer.error?.message}
        </Alert>
      )}

      {stopServer.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to stop server: {stopServer.error?.message}
        </Alert>
      )}

      {restartServer.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to restart server: {restartServer.error?.message}
        </Alert>
      )}

      {/* Server detail content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : data?.server ? (
        <ServerDetail server={data.server} />
      ) : (
        <Alert severity="warning">Server not found</Alert>
      )}
    </MainLayout>
  );
}
