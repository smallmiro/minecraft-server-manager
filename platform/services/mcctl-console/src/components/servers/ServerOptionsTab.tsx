'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useServerConfig, useUpdateServerConfig, useResetWorld, useRestartServer } from '@/hooks/useMcctl';
import { HostnameSection } from './HostnameSection';
import { SettingsSection, StickyActionBar, RestartConfirmDialog, sectionConfigs } from './settings';
import type { ServerConfig, UpdateServerConfigRequest } from '@/ports/api/IMcctlApiClient';

// Fields that require restart (must match backend RESTART_REQUIRED_FIELDS)
const RESTART_REQUIRED_FIELDS: (keyof ServerConfig)[] = [
  'memory', 'initMemory', 'maxMemory', 'useAikarFlags', 'jvmXxOpts',
  'onlineMode', 'enableWhitelist', 'enforceWhitelist', 'enforceSecureProfile',
  'level', 'seed', 'levelType',
  'enableAutopause', 'enableAutostop',
  'enableRcon', 'rconPassword', 'rconPort',
  'tz', 'uid', 'gid', 'stopDuration',
];

interface ServerOptionsTabProps {
  serverName: string;
  isRunning: boolean;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export function ServerOptionsTab({ serverName, isRunning }: ServerOptionsTabProps) {
  const { data: configData, isLoading } = useServerConfig(serverName);
  const updateConfig = useUpdateServerConfig();
  const resetWorldMutation = useResetWorld();
  const restartServer = useRestartServer();

  // Form state
  const [formData, setFormData] = useState<ServerConfig>({});
  const [originalData, setOriginalData] = useState<ServerConfig>({});

  // Dialog states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Initialize form data from API
  useEffect(() => {
    if (configData?.config) {
      setFormData(configData.config);
      setOriginalData(configData.config);
    }
  }, [configData]);

  // Compute changed fields
  const changedFields = useMemo(() => {
    const changed: string[] = [];
    for (const key of Object.keys(formData) as (keyof ServerConfig)[]) {
      if (formData[key] !== originalData[key]) {
        changed.push(key);
      }
    }
    // Also check keys that exist in original but not in form
    for (const key of Object.keys(originalData) as (keyof ServerConfig)[]) {
      if (formData[key] !== originalData[key] && !changed.includes(key)) {
        changed.push(key);
      }
    }
    return changed;
  }, [formData, originalData]);

  const hasChanges = changedFields.length > 0;
  const restartChangedFields = changedFields.filter((f) =>
    RESTART_REQUIRED_FIELDS.includes(f as keyof ServerConfig)
  );
  const hasRestartChanges = restartChangedFields.length > 0;

  // Handle form field change
  const handleChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setFormData(originalData);
  }, [originalData]);

  // Handle save (called after optional restart dialog)
  const doSave = useCallback(async (shouldRestart: boolean) => {
    try {
      const result = await updateConfig.mutateAsync({
        serverName,
        config: formData as UpdateServerConfigRequest,
      });

      setOriginalData(result.config);
      setFormData(result.config);

      if (shouldRestart && isRunning) {
        try {
          await restartServer.mutateAsync(serverName);
          setSnackbar({
            open: true,
            message: 'Settings saved. Server is restarting...',
            severity: 'warning',
          });
        } catch {
          setSnackbar({
            open: true,
            message: 'Settings saved, but server restart failed. Please restart manually.',
            severity: 'error',
          });
        }
      } else {
        setSnackbar({
          open: true,
          message: result.restartRequired
            ? 'Settings saved. Restart required for some changes to take effect.'
            : 'Settings saved successfully.',
          severity: result.restartRequired ? 'warning' : 'success',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save settings',
        severity: 'error',
      });
    } finally {
      setRestartDialogOpen(false);
    }
  }, [formData, serverName, isRunning, updateConfig, restartServer]);

  // Handle save button click
  const handleSave = useCallback(() => {
    if (hasRestartChanges && isRunning) {
      setRestartDialogOpen(true);
    } else {
      doSave(false);
    }
  }, [hasRestartChanges, isRunning, doSave]);

  // Handle reset world
  const handleResetWorld = async () => {
    if (resetConfirmation !== 'RESET') {
      setSnackbar({ open: true, message: 'Please type RESET to confirm', severity: 'warning' });
      return;
    }

    try {
      await resetWorldMutation.mutateAsync(serverName);
      setSnackbar({ open: true, message: 'World reset successfully', severity: 'success' });
      setResetDialogOpen(false);
      setResetConfirmation('');
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to reset world',
        severity: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Hostname / Domain Section */}
      <HostnameSection serverName={serverName} />

      {/* Settings Sections (6 cards) */}
      {sectionConfigs.map((section) => (
        <SettingsSection
          key={section.id}
          section={section}
          values={formData}
          onChange={handleChange}
        />
      ))}

      {/* Danger Zone */}
      <Card sx={{ borderRadius: 3, borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600} color="error">
            Danger Zone
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Reset World
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This will permanently delete the current world and generate a new one. This action cannot be undone.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RestartAltIcon />}
              onClick={() => setResetDialogOpen(true)}
              disabled={isRunning}
            >
              Reset World
            </Button>
            {isRunning && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Stop the server first
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Sticky Save Bar */}
      <StickyActionBar
        hasChanges={hasChanges}
        changedCount={changedFields.length}
        hasRestartChanges={hasRestartChanges}
        restartFields={restartChangedFields}
        isSaving={updateConfig.isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* Restart Confirm Dialog */}
      <RestartConfirmDialog
        open={restartDialogOpen}
        changedFields={restartChangedFields}
        onSaveOnly={() => doSave(false)}
        onSaveAndRestart={() => doSave(true)}
        onCancel={() => setRestartDialogOpen(false)}
      />

      {/* Reset World Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6" fontWeight={600}>
              Reset World
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            This will permanently delete the world for <strong>{serverName}</strong> and generate a new one.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This action cannot be undone. All player progress and builds will be lost.
          </Typography>
          <TextField
            fullWidth
            label="Type RESET to confirm"
            value={resetConfirmation}
            onChange={(e) => setResetConfirmation(e.target.value)}
            sx={{ mt: 3 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleResetWorld}
            disabled={resetConfirmation !== 'RESET' || resetWorldMutation.isPending}
            startIcon={resetWorldMutation.isPending ? <CircularProgress size={16} /> : <DeleteForeverIcon />}
          >
            {resetWorldMutation.isPending ? 'Resetting...' : 'Reset World'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
