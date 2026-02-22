'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import {
  useCreateBackupSchedule,
  useUpdateBackupSchedule,
} from '@/hooks/useMcctl';
import type { BackupScheduleItem } from '@/ports/api/IMcctlApiClient';

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at 3 AM', value: '0 3 * * *' },
  { label: 'Weekly (Sunday 3 AM)', value: '0 3 * * 0' },
  { label: 'Custom', value: 'custom' },
];

interface BackupScheduleDialogProps {
  open: boolean;
  schedule: BackupScheduleItem | null;
  onClose: () => void;
}

export function BackupScheduleDialog({ open, schedule, onClose }: BackupScheduleDialogProps) {
  const createMutation = useCreateBackupSchedule();
  const updateMutation = useUpdateBackupSchedule();

  const isEdit = !!schedule;

  const [name, setName] = useState('');
  const [cronPreset, setCronPreset] = useState('');
  const [customCron, setCustomCron] = useState('');
  const [maxCount, setMaxCount] = useState<string>('');
  const [maxAgeDays, setMaxAgeDays] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (schedule) {
        setName(schedule.name);
        // Check if the cron expression matches a preset
        const matchingPreset = CRON_PRESETS.find((p) => p.value === schedule.cronExpression);
        if (matchingPreset) {
          setCronPreset(matchingPreset.value);
          setCustomCron('');
        } else {
          setCronPreset('custom');
          setCustomCron(schedule.cronExpression);
        }
        setMaxCount(schedule.retentionPolicy.maxCount?.toString() ?? '');
        setMaxAgeDays(schedule.retentionPolicy.maxAgeDays?.toString() ?? '');
      } else {
        setName('');
        setCronPreset('0 3 * * *');
        setCustomCron('');
        setMaxCount('10');
        setMaxAgeDays('30');
      }
      setErrorMessage('');
    }
  }, [open, schedule]);

  const getCronExpression = () => {
    if (cronPreset === 'custom') {
      return customCron.trim();
    }
    return cronPreset;
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    const cronExpr = getCronExpression();
    if (!name.trim()) {
      setErrorMessage('Name is required');
      return;
    }
    if (!cronExpr) {
      setErrorMessage('Cron expression is required');
      return;
    }

    try {
      if (isEdit && schedule) {
        await updateMutation.mutateAsync({
          id: schedule.id,
          data: {
            name: name.trim(),
            cron: cronExpr,
            ...(maxCount ? { maxCount: parseInt(maxCount, 10) } : {}),
            ...(maxAgeDays ? { maxAgeDays: parseInt(maxAgeDays, 10) } : {}),
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          cron: cronExpr,
          ...(maxCount ? { maxCount: parseInt(maxCount, 10) } : {}),
          ...(maxAgeDays ? { maxAgeDays: parseInt(maxAgeDays, 10) } : {}),
          enabled: true,
        });
      }
      onClose();
    } catch (err) {
      const error = err as Error;
      setErrorMessage(error.message || 'Failed to save schedule');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Backup Schedule' : 'Create Backup Schedule'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {errorMessage && (
            <Alert severity="error" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          )}

          <TextField
            label="Schedule Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Daily backup, Hourly snapshot"
            autoFocus
          />

          <FormControl fullWidth>
            <InputLabel>Schedule Frequency</InputLabel>
            <Select
              value={cronPreset}
              onChange={(e) => setCronPreset(e.target.value)}
              label="Schedule Frequency"
            >
              {CRON_PRESETS.map((preset) => (
                <MenuItem key={preset.value} value={preset.value}>
                  {preset.label}
                  {preset.value !== 'custom' && (
                    <Chip
                      label={preset.value}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
                    />
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {cronPreset === 'custom' && (
            <TextField
              label="Cron Expression"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              fullWidth
              required
              placeholder="e.g., 0 */6 * * *"
              helperText="Format: minute hour day-of-month month day-of-week"
              InputProps={{
                sx: { fontFamily: 'monospace' },
              }}
            />
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Retention Policy (optional)
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Max Backup Count"
              type="number"
              value={maxCount}
              onChange={(e) => setMaxCount(e.target.value)}
              fullWidth
              placeholder="e.g., 10"
              inputProps={{ min: 1 }}
              helperText="Keep at most N backups"
            />

            <TextField
              label="Max Age (days)"
              type="number"
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(e.target.value)}
              fullWidth
              placeholder="e.g., 30"
              inputProps={{ min: 1 }}
              helperText="Delete backups older than N days"
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
