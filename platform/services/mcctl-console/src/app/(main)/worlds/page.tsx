'use client';

import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import PublicIcon from '@mui/icons-material/Public';
import { WorldList } from '@/components/worlds/WorldList';
import { CreateWorldDialog } from '@/components/worlds/CreateWorldDialog';
import { AssignWorldDialog } from '@/components/worlds/AssignWorldDialog';
import { WorldInfoPanel } from '@/components/worlds/WorldInfoPanel';
import {
  useWorlds,
  useCreateWorld,
  useCreateWorldWithZip,
  useAssignWorld,
  useReleaseWorld,
  useDeleteWorld,
} from '@/hooks/useMcctl';
import type { CreateWorldRequest } from '@/ports/api/IMcctlApiClient';
import { BentoGrid, BentoMetricCard, BentoPanel, PageHero } from '@/components/bento';

export default function WorldsPage() {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogWorld, setAssignDialogWorld] = useState<string | null>(null);
  const [deleteConfirmWorld, setDeleteConfirmWorld] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [infoWorld, setInfoWorld] = useState<string | null>(null);
  const [loadingWorlds, setLoadingWorlds] = useState<string[]>([]);

  // Data fetching
  const { data, isLoading, error } = useWorlds();

  // Mutations
  const createWorld = useCreateWorld();
  const createWorldWithZip = useCreateWorldWithZip();
  const assignWorld = useAssignWorld();
  const releaseWorld = useReleaseWorld();
  const deleteWorld = useDeleteWorld();
  const worlds = data?.worlds ?? [];
  const worldsUnavailable = !isLoading && (!data || Boolean(error));
  const assignedWorlds = worlds.filter((world) => world.isLocked).length;
  const freeWorlds = worlds.length - assignedWorlds;

  const handleCreateWorld = (request: CreateWorldRequest, zipFile?: File | null) => {
    if (zipFile) {
      createWorldWithZip.mutate(
        { data: request, zipFile },
        {
          onSuccess: () => {
            setCreateDialogOpen(false);
          },
        }
      );
    } else {
      createWorld.mutate(request, {
        onSuccess: () => {
          setCreateDialogOpen(false);
        },
      });
    }
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
      <PageHero
        title="Worlds"
        description="Manage your Minecraft worlds"
        eyebrow="World library"
        icon={<PublicIcon />}
        actions={(
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            size="large"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Create World
          </Button>
        )}
        sx={{ mb: 2.5 }}
      >
        <BentoGrid>
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 2', md: 'span 4' } }}>
            <BentoMetricCard
              title="Total worlds"
              value={isLoading ? <Skeleton width={56} /> : worldsUnavailable ? 'Unavailable' : worlds.length}
              icon={<PublicIcon />}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 2', md: 'span 4' } }}>
            <BentoMetricCard
              title="Assigned worlds"
              value={isLoading ? <Skeleton width={56} /> : worldsUnavailable ? 'Unavailable' : assignedWorlds}
              accent="warning"
              description="Attached to a server"
            />
          </Box>
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 2', md: 'span 4' } }}>
            <BentoMetricCard
              title="Free worlds"
              value={isLoading ? <Skeleton width={56} /> : worldsUnavailable ? 'Unavailable' : freeWorlds}
              accent="success"
              description="Ready to assign"
            />
          </Box>
        </BentoGrid>
      </PageHero>

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

      {createWorldWithZip.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to import world: {createWorldWithZip.error?.message}
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

      <BentoPanel
        role="region"
        aria-label="World inventory"
        aria-busy={isLoading}
        sx={{ p: { xs: 2, sm: 3 }, minHeight: 400 }}
      >
        {isLoading ? (
          <BentoGrid>
            {[0, 1, 2].map((item) => (
              <Box
                key={item}
                sx={{ gridColumn: { xs: '1 / -1', sm: 'span 3', md: 'span 4' } }}
              >
                <Skeleton variant="rounded" height={220} />
              </Box>
            ))}
          </BentoGrid>
        ) : worldsUnavailable ? (
          <Typography color="text.secondary">World inventory unavailable</Typography>
        ) : (
          <WorldList
            worlds={worlds}
            onAssign={(worldName) => setAssignDialogWorld(worldName)}
            onRelease={handleReleaseWorld}
            onDelete={handleDeleteClick}
            onViewInfo={(worldName) => setInfoWorld(worldName)}
            onCreate={() => setCreateDialogOpen(true)}
            loadingWorlds={loadingWorlds}
          />
        )}
      </BentoPanel>

      <CreateWorldDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          createWorld.reset();
          createWorldWithZip.reset();
        }}
        onSubmit={handleCreateWorld}
        loading={createWorld.isPending || createWorldWithZip.isPending}
      />

      <AssignWorldDialog
        open={!!assignDialogWorld}
        worldName={assignDialogWorld || ''}
        onClose={() => setAssignDialogWorld(null)}
        onSubmit={handleAssignWorld}
        loading={assignWorld.isPending}
      />

      {/* World Info Dialog */}
      <Dialog
        open={!!infoWorld}
        onClose={() => setInfoWorld(null)}
        maxWidth="md"
        fullWidth
        fullScreen={isSmallScreen}
      >
        <DialogTitle>World Details</DialogTitle>
        <DialogContent dividers>
          {infoWorld && <WorldInfoPanel worldName={infoWorld} />}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInfoWorld(null)}>Close</Button>
        </DialogActions>
      </Dialog>

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
