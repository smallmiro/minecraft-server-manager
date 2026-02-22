'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import {
  useBackupSchedules,
  useToggleBackupSchedule,
  useDeleteBackupSchedule,
} from '@/hooks/useMcctl';
import type { BackupScheduleItem } from '@/ports/api/IMcctlApiClient';
import { BackupScheduleDialog } from './BackupScheduleDialog';

/**
 * Format relative time from timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface ScheduleRowProps {
  schedule: BackupScheduleItem;
  onEdit: (schedule: BackupScheduleItem) => void;
  onDelete: (schedule: BackupScheduleItem) => void;
  onToggle: (schedule: BackupScheduleItem, enabled: boolean) => void;
  toggleLoading: boolean;
}

function ScheduleRow({ schedule, onEdit, onDelete, onToggle, toggleLoading }: ScheduleRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
        px: 1,
        '&:hover': {
          bgcolor: 'action.hover',
          borderRadius: 1,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        <ScheduleIcon color={schedule.enabled ? 'primary' : 'disabled'} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" fontWeight="medium" noWrap>
            {schedule.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {schedule.cronHumanReadable} ({schedule.cronExpression})
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        {/* Last run status */}
        {schedule.lastRunStatus && (
          <Tooltip
            title={
              schedule.lastRunMessage
                ? `${schedule.lastRunAt ? formatRelativeTime(schedule.lastRunAt) : ''}: ${schedule.lastRunMessage}`
                : schedule.lastRunAt
                  ? formatRelativeTime(schedule.lastRunAt)
                  : ''
            }
          >
            <Chip
              icon={
                schedule.lastRunStatus === 'success' ? (
                  <CheckCircleIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ErrorIcon sx={{ fontSize: 16 }} />
                )
              }
              label={schedule.lastRunStatus === 'success' ? 'OK' : 'Failed'}
              size="small"
              color={schedule.lastRunStatus === 'success' ? 'success' : 'error'}
              variant="outlined"
            />
          </Tooltip>
        )}

        {/* Retention info */}
        {(schedule.retentionPolicy.maxCount || schedule.retentionPolicy.maxAgeDays) && (
          <Tooltip
            title={[
              schedule.retentionPolicy.maxCount && `Max ${schedule.retentionPolicy.maxCount} backups`,
              schedule.retentionPolicy.maxAgeDays && `Max ${schedule.retentionPolicy.maxAgeDays} days`,
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <Chip
              label="Retention"
              size="small"
              variant="outlined"
              color="info"
            />
          </Tooltip>
        )}

        {/* Enable/Disable toggle */}
        <Tooltip title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}>
          <Switch
            size="small"
            checked={schedule.enabled}
            onChange={(_, checked) => onToggle(schedule, checked)}
            disabled={toggleLoading}
          />
        </Tooltip>

        {/* Edit */}
        <Tooltip title="Edit schedule">
          <IconButton size="small" onClick={() => onEdit(schedule)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Delete */}
        <Tooltip title="Delete schedule">
          <IconButton size="small" color="error" onClick={() => onDelete(schedule)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export function BackupScheduleList() {
  const { data, isLoading, error } = useBackupSchedules();
  const toggleMutation = useToggleBackupSchedule();
  const deleteMutation = useDeleteBackupSchedule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupScheduleItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<BackupScheduleItem | null>(null);

  const handleCreate = () => {
    setEditingSchedule(null);
    setDialogOpen(true);
  };

  const handleEdit = (schedule: BackupScheduleItem) => {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  };

  const handleDelete = (schedule: BackupScheduleItem) => {
    setDeletingSchedule(schedule);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingSchedule) {
      try {
        await deleteMutation.mutateAsync(deletingSchedule.id);
      } catch {
        // Error is handled by mutation
      }
    }
    setDeleteConfirmOpen(false);
    setDeletingSchedule(null);
  };

  const handleToggle = (schedule: BackupScheduleItem, enabled: boolean) => {
    toggleMutation.mutate({ id: schedule.id, enabled });
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSchedule(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup Schedules
          </Typography>
          <Typography color="text.secondary">Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup Schedules
          </Typography>
          <Alert severity="error">Failed to load backup schedules</Alert>
        </CardContent>
      </Card>
    );
  }

  const schedules = data?.schedules ?? [];

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6">Backup Schedules</Typography>
              <Typography variant="caption" color="text.secondary">
                Automated cron-based backup scheduling
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              Add Schedule
            </Button>
          </Box>

          {schedules.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ScheduleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                No backup schedules configured
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Create a schedule to automatically back up your worlds
              </Typography>
            </Box>
          ) : (
            <Stack divider={<Divider />}>
              {schedules.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  toggleLoading={toggleMutation.isPending}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <BackupScheduleDialog
        open={dialogOpen}
        schedule={editingSchedule}
        onClose={handleDialogClose}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Backup Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the schedule &quot;{deletingSchedule?.name}&quot;?
            This action cannot be undone.
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
