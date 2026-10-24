'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import { BentoGrid, BentoPanel, PageHero } from '@/components/bento';
import { HostnameDisplay } from '@/components/common';
import { ServerDetail } from '@/components/servers/ServerDetail';
import { ServerSwitcher } from '@/components/servers/ServerSwitcher';
import { useAppRouter } from '@/hooks/useAppRouter';
import {
  useDeleteServer,
  useRestartServer,
  useServer,
  useStartServer,
  useStopServer,
} from '@/hooks/useMcctl';
import { useServerStatus } from '@/hooks/useServerStatus';
import { formatUptime } from '@/utils/format';

function getServerTypeIcon(type?: string) {
  const normalizedType = type?.toUpperCase();
  if (normalizedType && ['PAPER', 'SPIGOT', 'BUKKIT', 'PURPUR'].includes(normalizedType)) {
    return <ExtensionOutlinedIcon fontSize="small" />;
  }
  if (normalizedType && ['FORGE', 'NEOFORGE', 'FABRIC', 'QUILT'].includes(normalizedType)) {
    return <BuildOutlinedIcon fontSize="small" />;
  }
  return <DnsOutlinedIcon fontSize="small" />;
}

function StatusDot({ color }: { color: string }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ width: 8, height: 8, ml: 1, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
    />
  );
}

function formatState(value?: string) {
  if (!value || value === 'none') return 'Unknown';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useAppRouter();
  const serverName = decodeURIComponent(params.name as string);
  const { data, isLoading, error } = useServer(serverName);
  const { status: sseStatus, health: sseHealth, isConnected } = useServerStatus({
    serverName,
    enabled: Boolean(serverName),
  });

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteWorld, setDeleteWorld] = useState(false);
  const [deleteSudoPassword, setDeleteSudoPassword] = useState('');
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();
  const deleteServer = useDeleteServer();
  const server = data?.server;
  const currentStatus = isConnected ? (sseStatus ?? server?.status) : server?.status;
  const currentHealth = isConnected ? (sseHealth ?? server?.health) : server?.health;
  const isRunning = currentStatus === 'running';
  const isStopped = ['stopped', 'exited', 'not_created', 'created'].includes(currentStatus ?? '');
  const isActionPending =
    startServer.isPending || stopServer.isPending || restartServer.isPending;

  const handleStartServer = async () => {
    try {
      await startServer.mutateAsync(serverName);
    } catch (startError) {
      console.error('Failed to start server:', startError);
    }
  };

  const handleStopServer = async () => {
    try {
      await stopServer.mutateAsync(serverName);
    } catch (stopError) {
      console.error('Failed to stop server:', stopError);
    }
  };

  const handleRestartServer = async () => {
    try {
      await restartServer.mutateAsync(serverName);
    } catch (restartError) {
      console.error('Failed to restart server:', restartError);
    }
  };

  // Rejects on failure so the console can show it
  const handleSendCommand = async (command: string) => {
    const response = await fetch(`/api/servers/${encodeURIComponent(serverName)}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const body = (await response.json().catch(() => null)) as
      | { message?: string; success?: boolean; output?: string }
      | null;
    if (!response.ok) {
      throw new Error(body?.message || `Request failed (${response.status})`);
    }
    if (body?.success === false) {
      throw new Error(body.output || 'Command failed');
    }
  };

  const handleDeleteServer = () => {
    if (deleteConfirmInput !== serverName) return;
    deleteServer.mutate(
      {
        name: serverName,
        force: true,
        deleteWorld,
        ...(deleteSudoPassword && { sudoPassword: deleteSudoPassword }),
      },
      {
        onSuccess: (data) => {
          setDeleteSudoPassword('');
          if (data.warning) setDeleteWarning(data.warning);
          else router.push('/servers');
        },
      },
    );
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteConfirmInput('');
    setDeleteSudoPassword('');
    if (deleteWarning) router.push('/servers');
  };

  const actionGroup = server ? (
    <Box
      role="group"
      aria-label="Server actions"
      sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}
    >
      {isStopped && (
        <Button
          variant="contained"
          startIcon={isActionPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
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
            startIcon={isActionPending ? <CircularProgress size={16} /> : <StopCircleOutlinedIcon />}
            onClick={handleStopServer}
            disabled={isActionPending}
          >
            Stop
          </Button>
          <Button
            variant="outlined"
            startIcon={isActionPending ? <CircularProgress size={16} /> : <RestartAltIcon />}
            onClick={handleRestartServer}
            disabled={isActionPending}
          >
            Restart
          </Button>
        </>
      )}
      <IconButton
        aria-label="Server actions"
        onClick={(event) => setMenuAnchorEl(event.currentTarget)}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
      >
        <MoreVertIcon />
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
            setDeleteWorld(false);
            setDeleteSudoPassword('');
            setDeleteWarning(null);
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
  ) : isLoading ? (
    <Skeleton variant="rounded" width={220} height={40} />
  ) : null;

  return (
    <>
      <BentoGrid aria-label="Server workspace">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/servers')}
          sx={{ gridColumn: '1 / -1', justifySelf: 'start' }}
        >
          All servers
        </Button>

        <PageHero
          compact
          aria-label="Server overview"
          aria-busy={isLoading ? 'true' : undefined}
          title={serverName}
          titleAction={<ServerSwitcher currentServer={serverName} />}
          eyebrow="Server operations"
          icon={server ? getServerTypeIcon(server.type) : <Skeleton variant="rounded" width={24} height={24} />}
          status={
            isLoading ? (
              <Skeleton variant="rounded" width={150} height={28} />
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  icon={
                    <StatusDot
                      color={isRunning ? 'success.main' : isStopped ? 'error.main' : 'text.disabled'}
                    />
                  }
                  label={formatState(currentStatus)}
                  variant="outlined"
                  color={isRunning ? 'success' : isStopped ? 'error' : 'default'}
                />
                <Chip
                  size="small"
                  label={formatState(currentHealth)}
                  color={
                    currentHealth === 'healthy'
                      ? 'success'
                      : currentHealth === 'unhealthy'
                        ? 'error'
                        : 'default'
                  }
                  variant="outlined"
                />
                {server?.type && <Chip size="small" label={server.type} variant="outlined" />}
                {server?.version && (
                  <Chip
                    size="small"
                    label={server.version}
                    variant="outlined"
                    sx={{ typography: 'mono', fontSize: '0.75rem' }}
                  />
                )}
                {!isConnected && (
                  <Chip size="small" label="Reconnecting" color="warning" variant="outlined" />
                )}
              </Stack>
            )
          }
          actions={actionGroup}
          sx={{ gridColumn: '1 / -1' }}
        >
          {server ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 2.5 }}
              useFlexGap
              flexWrap="wrap"
              sx={{ color: 'text.secondary', minWidth: 0 }}
            >
              {server.hostname && (
                <Box sx={{ minWidth: 0, overflow: 'hidden', typography: 'mono' }}>
                  <HostnameDisplay hostname={server.hostname} fontSize={13} showCopyButton />
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Typography variant="label">Uptime</Typography>
                <Typography variant="mono" color="text.primary">
                  {server.uptimeSeconds !== undefined
                    ? formatUptime(server.uptimeSeconds)
                    : server.uptime || '—'}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Skeleton variant="text" width="55%" />
          )}
        </PageHero>

        {[error, startServer.isError, stopServer.isError, restartServer.isError, deleteServer.isError].map(
          (hasError, index) => {
            if (!hasError) return null;
            const messages = [
              `Failed to load server: ${error?.message}`,
              `Failed to start server: ${startServer.error?.message}`,
              `Failed to stop server: ${stopServer.error?.message}`,
              `Failed to restart server: ${restartServer.error?.message}`,
              `Failed to delete server: ${deleteServer.error?.message}`,
            ];
            return (
              <Alert key={messages[index]} severity="error" sx={{ gridColumn: '1 / -1' }}>
                {messages[index]}
              </Alert>
            );
          },
        )}

        {isLoading ? (
          <BentoPanel
            aria-label="Server detail loading"
            sx={{ gridColumn: '1 / -1', p: 3 }}
          >
            <Stack spacing={2}>
              <Skeleton variant="rounded" height={48} />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 2,
                }}
              >
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} variant="rounded" height={152} />
                ))}
              </Box>
              <Skeleton variant="rounded" height={360} />
            </Stack>
          </BentoPanel>
        ) : server ? (
          <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <ServerDetail server={currentStatus ? { ...server, status: currentStatus } : server} onSendCommand={handleSendCommand} />
          </Box>
        ) : !error ? (
          <Alert severity="warning" sx={{ gridColumn: '1 / -1' }}>
            Server not found
          </Alert>
        ) : null}
      </BentoGrid>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{deleteWarning ? 'Server deleted' : 'Delete Server'}</DialogTitle>
        {deleteWarning ? (
          <>
            <DialogContent>
              <Alert severity="warning">{deleteWarning}</Alert>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button variant="contained" onClick={closeDeleteDialog}>
                Close
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogContent>
              <Typography sx={{ mb: 2 }}>
                This action cannot be undone. Type <strong>{serverName}</strong> to confirm deletion.
              </Typography>
              <TextField
                label="Server name"
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                fullWidth
                autoFocus
              />
              <FormControl sx={{ mt: 2 }}>
                <FormLabel id="delete-world-label">World</FormLabel>
                <RadioGroup
                  aria-labelledby="delete-world-label"
                  value={deleteWorld ? 'delete' : 'keep'}
                  onChange={(event) => setDeleteWorld(event.target.value === 'delete')}
                >
                  <FormControlLabel
                    value="keep"
                    control={<Radio />}
                    label="Keep the world (move to worlds/)"
                  />
                  <FormControlLabel
                    value="delete"
                    control={<Radio />}
                    label="Delete the world inside the server too"
                  />
                </RadioGroup>
              </FormControl>
              <TextField
                label="Sudo Password"
                type="password"
                value={deleteSudoPassword}
                onChange={(event) => setDeleteSudoPassword(event.target.value)}
                helperText="Optional. Used to remove the mDNS hostname (avahi); leave empty if sudo needs no password"
                autoComplete="off"
                fullWidth
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeDeleteDialog}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteServer}
                disabled={deleteConfirmInput !== serverName || deleteServer.isPending}
                startIcon={deleteServer.isPending ? <CircularProgress size={16} /> : null}
              >
                {deleteServer.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
