'use client';

import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import PublicIcon from '@mui/icons-material/Public';
import { WorldList } from '@/components/worlds/WorldList';
import { CreateWorldDialog } from '@/components/worlds/CreateWorldDialog';
import { AssignWorldDialog } from '@/components/worlds/AssignWorldDialog';
import {
  useWorlds,
  useCreateWorld,
  useAssignWorld,
  useReleaseWorld,
  useDeleteWorld,
} from '@/hooks/useMcctl';
import type { CreateWorldRequest } from '@/ports/api/IMcctlApiClient';

export default function WorldsPage() {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogWorld, setAssignDialogWorld] = useState<string | null>(null);
  const [deleteConfirmWorld, setDeleteConfirmWorld] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [loadingWorlds, setLoadingWorlds] = useState<string[]>([]);

  // Data fetching
  const { data, isLoading, error } = useWorlds();

  // Mutations
  const createWorld = useCreateWorld();
  const assignWorld = useAssignWorld();
  const releaseWorld = useReleaseWorld();
  const deleteWorld = useDeleteWorld();

  const handleCreateWorld = (request: CreateWorldRequest) => {
    createWorld.mutate(request, {
      onSuccess: () => {
        setCreateDialogOpen(false);
      },
    });
  };

  const handleAssignWorld = (worldName: string, serverName: string) => {
    setLoadingWorlds((prev) => [...prev, worldName]);
    assignWorld.mutate(
      { worldName, serverName },
      {
        onSuccess: () => {
          setAssignDialogWorld(null);
        },
        onSettled: () => {
          setLoadingWorlds((prev) => prev.filter((n) => n !== worldName));
        },
      }
    );
  };

  const handleReleaseWorld = async (worldName: string) => {
    setLoadingWorlds((prev) => [...prev, worldName]);
    try {
      await releaseWorld.mutateAsync({ worldName });
    } catch (err) {
      console.error('Failed to release world:', err);
    } finally {
      setLoadingWorlds((prev) => prev.filter((n) => n !== worldName));
    }
  };

  const handleDeleteWorld = () => {
    if (!deleteConfirmWorld || deleteConfirmInput !== deleteConfirmWorld) return;

    setLoadingWorlds((prev) => [...prev, deleteConfirmWorld]);
    deleteWorld.mutate(
      { name: deleteConfirmWorld, force: true },
      {
        onSuccess: () => {
          setDeleteConfirmWorld(null);
          setDeleteConfirmInput('');
        },
        onSettled: () => {
          setLoadingWorlds((prev) =>
            prev.filter((n) => n !== deleteConfirmWorld)
          );
        },
      }
    );
  };

  const handleDeleteClick = (worldName: string) => {
    setDeleteConfirmWorld(worldName);
    setDeleteConfirmInput('');
  };

  return (
    <>
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'success.main',
              color: 'success.contrastText',
            }}
          >
            <PublicIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              Worlds
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your Minecraft worlds
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="large"
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Create World
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load worlds: {error.message}
        </Alert>
      )}

      {createWorld.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to create world: {createWorld.error?.message}
        </Alert>
      )}

      {assignWorld.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to assign world: {assignWorld.error?.message}
        </Alert>
      )}

      {releaseWorld.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to release world: {releaseWorld.error?.message}
        </Alert>
      )}

      {deleteWorld.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to delete world: {deleteWorld.error?.message}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <WorldList
          worlds={data?.worlds || []}
          onAssign={(worldName) => setAssignDialogWorld(worldName)}
          onRelease={handleReleaseWorld}
          onDelete={handleDeleteClick}
          onCreate={() => setCreateDialogOpen(true)}
          loadingWorlds={loadingWorlds}
        />
      )}

      <CreateWorldDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          createWorld.reset();
        }}
        onSubmit={handleCreateWorld}
        loading={createWorld.isPending}
      />

      <AssignWorldDialog
        open={!!assignDialogWorld}
        worldName={assignDialogWorld || ''}
        onClose={() => setAssignDialogWorld(null)}
        onSubmit={handleAssignWorld}
        loading={assignWorld.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmWorld}
        onClose={() => {
          setDeleteConfirmWorld(null);
          setDeleteConfirmInput('');
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={isSmallScreen}
      >
        <DialogTitle>Delete World</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This action cannot be undone. Type <strong>{deleteConfirmWorld}</strong> to confirm deletion.
          </Typography>
          <TextField
            label="World name"
            value={deleteConfirmInput}
            onChange={(e) => setDeleteConfirmInput(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteConfirmWorld(null);
              setDeleteConfirmInput('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteWorld}
            disabled={
              deleteConfirmInput !== deleteConfirmWorld ||
              deleteWorld.isPending
            }
            startIcon={
              deleteWorld.isPending ? <CircularProgress size={16} /> : null
            }
          >
            {deleteWorld.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
