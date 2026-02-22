'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { ConfigSnapshotScheduleItem } from '@/ports/api/IMcctlApiClient';

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
  schedule: ConfigSnapshotScheduleItem;
  onEdit: (schedule: ConfigSnapshotScheduleItem) => void;
  onDelete: (schedule: ConfigSnapshotScheduleItem) => void;
  onToggle: (schedule: ConfigSnapshotScheduleItem, enabled: boolean) => void;
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
          <Typography variant="body2" fontWeight="medium" noWrap>
            {schedule.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {schedule.serverName} | {schedule.cronExpression} | Retain: {schedule.retentionCount}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {/* Last run status */}
        {schedule.lastRunStatus && (
          <Tooltip
            title={
              schedule.lastRunAt
                ? `Last run: ${formatRelativeTime(schedule.lastRunAt)} (${schedule.lastRunStatus})`
                : schedule.lastRunStatus
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

interface ConfigSnapshotScheduleListProps {
  schedules: ConfigSnapshotScheduleItem[];
  onEdit: (schedule: ConfigSnapshotScheduleItem) => void;
  onDelete: (schedule: ConfigSnapshotScheduleItem) => void;
  onToggle: (schedule: ConfigSnapshotScheduleItem, enabled: boolean) => void;
  toggleLoading: boolean;
}

/**
 * ConfigSnapshotScheduleList - Table of existing config snapshot schedules
 * with toggle and action buttons per row.
 */
export function ConfigSnapshotScheduleList({
  schedules,
  onEdit,
  onDelete,
  onToggle,
  toggleLoading,
}: ConfigSnapshotScheduleListProps) {
  if (schedules.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <ScheduleIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary" variant="body2">
          No config snapshot schedules configured
        </Typography>
      </Box>
    );
  }

  return (
    <Stack divider={<Divider />}>
      {schedules.map((schedule) => (
        <ScheduleRow
          key={schedule.id}
          schedule={schedule}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          toggleLoading={toggleLoading}
        />
      ))}
    </Stack>
  );
}
