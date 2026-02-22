'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import type { ConfigSnapshotScheduleItem } from '@/ports/api/IMcctlApiClient';

/**
 * Common cron presets for convenience
 */
const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 3 AM', value: '0 3 * * *' },
  { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
  { label: 'Custom', value: '' },
];

interface ConfigSnapshotScheduleFormProps {
  serverNames: string[];
  editingSchedule?: ConfigSnapshotScheduleItem | null;
  onSubmit: (data: {
    serverName: string;
    name: string;
    cronExpression: string;
    retentionCount: number;
  }) => void;
  onUpdate?: (data: {
    name: string;
    cronExpression: string;
    retentionCount: number;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

/**
 * ConfigSnapshotScheduleForm - Form for creating or editing a config snapshot schedule.
 * Includes cron expression presets and validation.
 */
export function ConfigSnapshotScheduleForm({
  serverNames,
  editingSchedule,
  onSubmit,
  onUpdate,
  onCancel,
  isSubmitting,
  error,
}: ConfigSnapshotScheduleFormProps) {
  const isEditing = !!editingSchedule;

  const [serverName, setServerName] = useState(editingSchedule?.serverName || '');
  const [name, setName] = useState(editingSchedule?.name || '');
  const [cronPreset, setCronPreset] = useState('');
  const [cronExpression, setCronExpression] = useState(editingSchedule?.cronExpression || '0 0 * * *');
  const [retentionCount, setRetentionCount] = useState(editingSchedule?.retentionCount ?? 10);

  // Determine if current cron matches a preset
  useEffect(() => {
    const matchingPreset = CRON_PRESETS.find((p) => p.value === cronExpression);
    setCronPreset(matchingPreset ? matchingPreset.value : '');
  }, [cronExpression]);

  // Reset form when editingSchedule changes
  useEffect(() => {
    if (editingSchedule) {
      setServerName(editingSchedule.serverName);
      setName(editingSchedule.name);
      setCronExpression(editingSchedule.cronExpression);
      setRetentionCount(editingSchedule.retentionCount);
    } else {
      setServerName('');
      setName('');
      setCronExpression('0 0 * * *');
      setRetentionCount(10);
    }
  }, [editingSchedule]);

  const handlePresetChange = (value: string) => {
    setCronPreset(value);
    if (value) {
      setCronExpression(value);
    }
  };

  const handleSubmit = () => {
    if (isEditing && onUpdate) {
      onUpdate({
        name: name.trim(),
        cronExpression,
        retentionCount,
      });
    } else {
      onSubmit({
        serverName,
        name: name.trim(),
        cronExpression,
        retentionCount,
      });
    }
  };

  const isValid = (isEditing || serverName) && name.trim() && cronExpression.trim();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {isEditing ? 'Edit Schedule' : 'Create New Schedule'}
      </Typography>

      {!isEditing && (
        <FormControl fullWidth size="small" required>
          <InputLabel>Server</InputLabel>
          <Select
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            label="Server"
            disabled={isSubmitting}
          >
            {serverNames.map((sn) => (
              <MenuItem key={sn} value={sn}>
                {sn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <TextField
        label="Schedule Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Daily config backup"
        size="small"
        fullWidth
        required
        disabled={isSubmitting}
      />

      <FormControl fullWidth size="small">
        <InputLabel>Cron Preset</InputLabel>
        <Select
          value={cronPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          label="Cron Preset"
          disabled={isSubmitting}
        >
          {CRON_PRESETS.map((preset) => (
            <MenuItem key={preset.label} value={preset.value}>
              {preset.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Cron Expression"
        value={cronExpression}
        onChange={(e) => setCronExpression(e.target.value)}
        placeholder="0 0 * * *"
        size="small"
        fullWidth
        required
        disabled={isSubmitting}
        helperText="Standard cron format: minute hour day month weekday"
      />

      <TextField
        label="Retention Count"
        type="number"
        value={retentionCount}
        onChange={(e) => setRetentionCount(Math.max(1, parseInt(e.target.value) || 1))}
        size="small"
        fullWidth
        disabled={isSubmitting}
        helperText="Maximum number of scheduled snapshots to keep per server"
        inputProps={{ min: 1, max: 100 }}
      />

      {error && (
        <Alert severity="error" sx={{ py: 0 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
}
