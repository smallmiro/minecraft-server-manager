'use client';

import { useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import type { ConfigSnapshotScheduleItem } from '@/ports/api/IMcctlApiClient';
import {
  useConfigSnapshotSchedules,
  useCreateConfigSnapshotSchedule,
  useUpdateConfigSnapshotSchedule,
  useToggleConfigSnapshotSchedule,
  useDeleteConfigSnapshotSchedule,
} from '@/hooks/useConfigSnapshotSchedules';
import { ConfigSnapshotScheduleList } from './ConfigSnapshotScheduleList';
import { ConfigSnapshotScheduleForm } from './ConfigSnapshotScheduleForm';

interface ConfigSnapshotSchedulePanelProps {
  open: boolean;
  onClose: () => void;
  serverNames: string[];
  /** When provided, only show schedules for this server */
  filterServerName?: string;
}

/**
 * ConfigSnapshotSchedulePanel - Slide-over drawer for managing config snapshot schedules.
 * Contains the schedule list, create/edit form, and delete confirmation.
 */
export function ConfigSnapshotSchedulePanel({
  open,
  onClose,
  serverNames,
  filterServerName,
}: ConfigSnapshotSchedulePanelProps) {
  const { data, isLoading, error } = useConfigSnapshotSchedules(filterServerName);
  const createMutation = useCreateConfigSnapshotSchedule();
  const updateMutation = useUpdateConfigSnapshotSchedule();
  const toggleMutation = useToggleConfigSnapshotSchedule();
  const deleteMutation = useDeleteConfigSnapshotSchedule();

  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ConfigSnapshotScheduleItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<ConfigSnapshotScheduleItem | null>(null);

  const schedules = data?.schedules ?? [];

  const handleCreate = () => {
    setEditingSchedule(null);
    setShowForm(true);
  };

  const handleEdit = (schedule: ConfigSnapshotScheduleItem) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleDelete = (schedule: ConfigSnapshotScheduleItem) => {
    setDeletingSchedule(schedule);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingSchedule) {
      try {
        await deleteMutation.mutateAsync(deletingSchedule.id);
      } catch {
        // Error handled by mutation
      }
    }
    setDeleteConfirmOpen(false);
    setDeletingSchedule(null);
  };

  const handleToggle = (schedule: ConfigSnapshotScheduleItem, enabled: boolean) => {
    toggleMutation.mutate({ id: schedule.id, enabled });
  };

  const handleFormSubmit = async (formData: {
    serverName: string;
    name: string;
    cronExpression: string;
    retentionCount: number;
  }) => {
    try {
      await createMutation.mutateAsync({
        serverName: formData.serverName,
        name: formData.name,
        cronExpression: formData.cronExpression,
        retentionCount: formData.retentionCount,
      });
      setShowForm(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleFormUpdate = async (formData: {
    name: string;
    cronExpression: string;
    retentionCount: number;
  }) => {
    if (!editingSchedule) return;
    try {
      await updateMutation.mutateAsync({
        id: editingSchedule.id,
        data: formData,
      });
      setShowForm(false);
      setEditingSchedule(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSchedule(null);
    createMutation.reset();
    updateMutation.reset();
  };

  const formError = createMutation.error?.message || updateMutation.error?.message || null;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 480 }, p: 3 },
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            Config Snapshot Schedules
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Add schedule button */}
        {!showForm && (
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            fullWidth
            sx={{ mb: 2 }}
          >
            Add Schedule
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <Box sx={{ mb: 2 }}>
            <ConfigSnapshotScheduleForm
              serverNames={serverNames}
              editingSchedule={editingSchedule}
              onSubmit={handleFormSubmit}
              onUpdate={handleFormUpdate}
              onCancel={handleFormCancel}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
              error={formError}
            />
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        {/* Schedule list */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">Failed to load schedules</Alert>
        ) : (
          <ConfigSnapshotScheduleList
            schedules={schedules}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
            toggleLoading={toggleMutation.isPending}
          />
        )}
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Config Snapshot Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the schedule &quot;{deletingSchedule?.name}&quot;?
            Existing snapshots created by this schedule will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
