'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/useAppRouter';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LinkIcon from '@mui/icons-material/Link';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ServerDetail } from '@/components/servers/ServerDetail';
import { HostnameDisplay } from '@/components/common';
import {
  useServer,
  useStartServer,
  useStopServer,
  useRestartServer,
  useDeleteServer,
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

/**
 * Server type icon mapping
 * - Plugin servers (Paper, Spigot, Bukkit, Purpur): 🔌
 * - Mod servers (Forge, NeoForge, Fabric, Quilt): 🔧
 * - Vanilla: 🎮
 */
function getServerTypeIcon(type?: string): string {
  if (!type) return '🎮';
  const t = type.toUpperCase();
  // Plugin servers
  if (['PAPER', 'SPIGOT', 'BUKKIT', 'PURPUR'].includes(t)) return '🔌';
  // Mod servers
  if (['FORGE', 'NEOFORGE', 'FABRIC', 'QUILT'].includes(t)) return '🔧';
  // Vanilla
  if (t === 'VANILLA') return '🎮';
  return '🎮';
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

  // Menu & delete dialog state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Mutations
  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();
  const deleteServer = useDeleteServer();

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

  const handleDeleteServer = () => {
    if (deleteConfirmInput !== serverName) return;
    deleteServer.mutate(
      { name: serverName, force: true },
      {
        onSuccess: () => {
          router.push('/servers');
        },
      }
    );
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

      {deleteServer.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to delete server: {deleteServer.error?.message}
        </Alert>
      )}

      {/* Loading */}
      {isLoading ? (
        <>
          {/* Skeleton Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            <Skeleton variant="rounded" width={64} height={64} sx={{ borderRadius: 3, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={80} height={18} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width="40%" height={40} />
              <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
                <Skeleton variant="text" width={100} />
                <Skeleton variant="text" width={60} />
                <Skeleton variant="text" width={140} />
                <Skeleton variant="text" width={50} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Skeleton variant="rounded" width={90} height={40} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 2 }} />
            </Box>
          </Box>

          {/* Skeleton Tabs */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 3 }}>
            {[80, 70, 65, 50, 65, 65].map((w, i) => (
              <Skeleton key={i} variant="rounded" width={w} height={36} sx={{ borderRadius: 5 }} />
            ))}
          </Box>

          {/* Skeleton Stat Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
            {[0, 1, 2].map((i) => (
              <Card key={i} sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Skeleton variant="text" width="50%" />
                    <Skeleton variant="circular" width={28} height={28} />
                  </Box>
                  <Skeleton variant="text" width="60%" height={36} />
                  <Skeleton variant="rounded" width="100%" height={6} sx={{ borderRadius: 3, mt: 1 }} />
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Skeleton Console */}
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Skeleton variant="text" width={80} height={28} />
              <Skeleton variant="circular" width={10} height={10} />
            </Box>
            <Skeleton variant="rectangular" height={360} sx={{ bgcolor: '#0a0a0a' }} />
            <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Skeleton variant="rounded" width="100%" height={40} sx={{ borderRadius: 2 }} />
            </Box>
          </Card>

          {/* Skeleton Overview Cards */}
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={1} sx={{ mb: 2 }} />
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Skeleton variant="text" width="30%" />
                      <Skeleton variant="text" width="40%" />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Skeleton variant="text" width="30%" height={28} sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={1} sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                    <Skeleton variant="text" width="25%" />
                    <Skeleton variant="text" width="20%" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      ) : server ? (
        <>
          {/* Page Header - Pyro SMP style */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            {/* Server Icon - type-based emoji */}
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
              {getServerTypeIcon(server.type)}
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
                      <HostnameDisplay hostname={server.hostname} fontSize={13} />
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
                onClick={(e) => setMenuAnchorEl(e.currentTarget)}
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
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={() => setMenuAnchorEl(null)}
              >
                <MenuItem
                  onClick={() => {
                    setMenuAnchorEl(null);
                    setDeleteDialogOpen(true);
                    setDeleteConfirmInput('');
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                  </ListItemIcon>
                  <ListItemText>Delete Server</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Server Detail Component */}
          <ServerDetail server={server} onSendCommand={handleSendCommand} />
        </>
      ) : (
        <Alert severity="warning">Server not found</Alert>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmInput('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Server</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This action cannot be undone. Type <strong>{serverName}</strong> to confirm deletion.
          </Typography>
          <TextField
            label="Server name"
            value={deleteConfirmInput}
            onChange={(e) => setDeleteConfirmInput(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmInput('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteServer}
            disabled={
              deleteConfirmInput !== serverName ||
              deleteServer.isPending
            }
            startIcon={
              deleteServer.isPending ? <CircularProgress size={16} /> : null
            }
          >
            {deleteServer.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
