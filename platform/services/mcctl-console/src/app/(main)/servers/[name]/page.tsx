'use client';

import { useParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/useAppRouter';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LinkIcon from '@mui/icons-material/Link';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ServerDetail } from '@/components/servers/ServerDetail';
import {
  useServer,
  useStartServer,
  useStopServer,
  useRestartServer,
} from '@/hooks/useMcctl';
import { useServerStatus } from '@/hooks/useServerStatus';

// Format uptime from seconds
function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Stop Icon for button
function StopButtonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

// Restart Icon for button
function RestartButtonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
    </svg>
  );
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useAppRouter();
  const serverName = decodeURIComponent(params.name as string);

  // Fetch server detail (initial data)
  const { data, isLoading, error } = useServer(serverName);

  // Real-time status updates
  const { status: sseStatus, health: sseHealth } = useServerStatus({
    serverName,
    enabled: !!serverName,
  });

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

  const handleSendCommand = async (command: string) => {
    try {
      await fetch(`/api/servers/${encodeURIComponent(serverName)}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
    } catch (err) {
      console.error('Failed to send command:', err);
    }
  };

  // Use SSE status if available, otherwise fall back to server data
  const currentStatus = sseStatus || data?.server.status;

  const isRunning = currentStatus === 'running';
  const isStopped = currentStatus === 'stopped' || currentStatus === 'exited' || currentStatus === 'not_created';

  const isActionPending =
    startServer.isPending || stopServer.isPending || restartServer.isPending;

  const server = data?.server;

  return (
    <>
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

      {/* Loading */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : server ? (
        <>
          {/* Page Header - Pyro SMP style */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            {/* Server Icon */}
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid',
                borderColor: 'divider',
                fontSize: 36,
              }}
            >
              {server.type?.toLowerCase().includes('fabric') && '🧵'}
              {server.type?.toLowerCase().includes('forge') && '🔨'}
              {server.type?.toLowerCase().includes('paper') && '📄'}
              {server.type?.toLowerCase().includes('spigot') && '🔌'}
              {!server.type && '🎮'}
            </Box>

            {/* Server Info */}
            <Box sx={{ flex: 1 }}>
              <Typography
                onClick={() => router.push('/servers')}
                sx={{
                  fontSize: 12,
                  color: 'primary.main',
                  cursor: 'pointer',
                  mb: 0.25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 14 }} /> All servers
              </Typography>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontFamily: '"Minecraft", sans-serif',
                  fontWeight: 400,
                  color: 'text.primary',
                  letterSpacing: '0.5px',
                  m: 0,
                  textTransform: 'uppercase',
                }}
              >
                {serverName}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  mt: 0.75,
                  flexWrap: 'wrap',
                  fontSize: 13,
                  color: 'text.secondary',
                }}
              >
                {/* Version */}
                {server.version && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ViewInArIcon sx={{ fontSize: 14 }} />
                      Minecraft {server.version}
                    </Box>
                    <Box component="span" sx={{ mx: 1.25, color: '#3a3d4e' }}>
                      |
                    </Box>
                  </>
                )}
                {/* Type */}
                {server.type && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocalOfferIcon sx={{ fontSize: 14 }} />
                      {server.type}
                    </Box>
                    <Box component="span" sx={{ mx: 1.25, color: '#3a3d4e' }}>
                      |
                    </Box>
                  </>
                )}
                {/* Hostname */}
                {server.hostname && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LinkIcon sx={{ fontSize: 14 }} />
                      {server.hostname}
                    </Box>
                    <Box component="span" sx={{ mx: 1.25, color: '#3a3d4e' }}>
                      |
                    </Box>
                  </>
                )}
                {/* Uptime */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 14 }} />
                  {server.uptime || formatUptime(server.uptimeSeconds) || '0s'}
                </Box>
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0 }}>
              {isStopped && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={isActionPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                  onClick={handleStartServer}
                  disabled={isActionPending}
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Start
                </Button>
              )}
              {isRunning && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={isActionPending ? <CircularProgress size={16} /> : <StopButtonIcon />}
                    onClick={handleStopServer}
                    disabled={isActionPending}
                    sx={{
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      fontSize: 14,
                      fontWeight: 500,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: 'text.secondary',
                        bgcolor: alpha('#fff', 0.05),
                      },
                    }}
                  >
                    Stop
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={isActionPending ? <CircularProgress size={16} color="inherit" /> : <RestartButtonIcon />}
                    onClick={handleRestartServer}
                    disabled={isActionPending}
                    sx={{
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      fontSize: 14,
                      fontWeight: 600,
                      bgcolor: 'primary.main',
                      color: '#0a0e14',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    }}
                  >
                    Restart
                  </Button>
                </>
              )}
              <IconButton
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'text.secondary',
                }}
              >
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Server Detail Component */}
          <ServerDetail server={server} onSendCommand={handleSendCommand} />
        </>
      ) : (
        <Alert severity="warning">Server not found</Alert>
      )}
    </>
  );
}
