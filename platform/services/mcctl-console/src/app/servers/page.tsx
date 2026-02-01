'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import StorageIcon from '@mui/icons-material/Storage';
import { MainLayout } from '@/components/layout/MainLayout';
import { ServerList } from '@/components/servers/ServerList';
import { CreateServerDialog } from '@/components/servers/CreateServerDialog';
import {
  useServers,
  useCreateServer,
  useStartServer,
  useStopServer,
} from '@/hooks/useMcctl';
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';

export default function ServersPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loadingServers, setLoadingServers] = useState<string[]>([]);

  // Fetch servers
  const { data, isLoading, error } = useServers();

  // Mutations
  const createServer = useCreateServer();
  const startServer = useStartServer();
  const stopServer = useStopServer();

  const handleServerClick = (serverName: string) => {
    router.push(`/servers/${encodeURIComponent(serverName)}`);
  };

  const handleCreateServer = async (request: CreateServerRequest) => {
    try {
      await createServer.mutateAsync(request);
      setCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create server:', err);
    }
  };

  const handleStartServer = async (serverName: string) => {
    setLoadingServers((prev) => [...prev, serverName]);
    try {
      await startServer.mutateAsync(serverName);
    } catch (err) {
      console.error('Failed to start server:', err);
    } finally {
      setLoadingServers((prev) => prev.filter((name) => name !== serverName));
    }
  };

  const handleStopServer = async (serverName: string) => {
    setLoadingServers((prev) => [...prev, serverName]);
    try {
      await stopServer.mutateAsync(serverName);
    } catch (err) {
      console.error('Failed to stop server:', err);
    } finally {
      setLoadingServers((prev) => prev.filter((name) => name !== serverName));
    }
  };

  return (
    <MainLayout title="Servers">
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
            <StorageIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Servers
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your Minecraft servers
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="large"
        >
          Create Server
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load servers: {error.message}
        </Alert>
      )}

      {createServer.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to create server: {createServer.error?.message}
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

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <ServerList
          servers={data?.servers || []}
          onServerClick={handleServerClick}
          onStart={handleStartServer}
          onStop={handleStopServer}
          onCreate={() => setCreateDialogOpen(true)}
          loadingServers={loadingServers}
        />
      )}

      <CreateServerDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateServer}
        loading={createServer.isPending}
      />
    </MainLayout>
  );
}
