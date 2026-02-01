'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Server
        </Button>
      </Box>

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
