'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import SaveIcon from '@mui/icons-material/Save';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useServerConfig, useUpdateServerConfig, useResetWorld } from '@/hooks/useMcctl';
import type { Difficulty, GameMode, ServerConfig, UpdateServerConfigRequest } from '@/ports/api/IMcctlApiClient';

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

  // Form state
  const [formData, setFormData] = useState<ServerConfig>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [performanceChanged, setPerformanceChanged] = useState(false);

  // Dialog states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');

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
    }
  }, [configData]);

  // Handle form field changes
  const handleChange = (field: keyof ServerConfig, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);

    // Track if performance settings changed
    if (field === 'memory' || field === 'useAikarFlags') {
      setPerformanceChanged(true);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      const result = await updateConfig.mutateAsync({
        serverName,
        config: formData as UpdateServerConfigRequest,
      });

      setSnackbar({
        open: true,
        message: result.restartRequired
          ? 'Settings saved. Restart required for some changes to take effect.'
          : 'Settings saved successfully.',
        severity: result.restartRequired ? 'warning' : 'success',
      });

      setHasChanges(false);
      setPerformanceChanged(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save settings',
        severity: 'error',
      });
    }
  };

  // Handle reset world
  const handleResetWorld = async () => {
    if (resetConfirmation !== 'RESET') {
      setSnackbar({
        open: true,
        message: 'Please type RESET to confirm',
        severity: 'warning',
      });
      return;
    }

    try {
      await resetWorldMutation.mutateAsync(serverName);
      setSnackbar({
        open: true,
        message: 'World reset successfully',
        severity: 'success',
      });
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
      {/* Performance Warning Alert */}
      {performanceChanged && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          Performance settings require a server restart to take effect.
        </Alert>
      )}

      {/* Server Properties Section */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Server Properties
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These settings can be changed without restarting the server.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            {/* MOTD */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="MOTD (Message of the Day)"
                value={formData.motd || ''}
                onChange={(e) => handleChange('motd', e.target.value)}
                helperText="The message displayed in the server list"
              />
            </Grid>

            {/* Max Players */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Players"
                value={formData.maxPlayers || 20}
                onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value, 10))}
                inputProps={{ min: 1, max: 100 }}
              />
            </Grid>

            {/* Difficulty */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={formData.difficulty || 'normal'}
                  label="Difficulty"
                  onChange={(e) => handleChange('difficulty', e.target.value as Difficulty)}
                >
                  <MenuItem value="peaceful">Peaceful</MenuItem>
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Game Mode */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Game Mode</InputLabel>
                <Select
                  value={formData.gameMode || 'survival'}
                  label="Game Mode"
                  onChange={(e) => handleChange('gameMode', e.target.value as GameMode)}
                >
                  <MenuItem value="survival">Survival</MenuItem>
                  <MenuItem value="creative">Creative</MenuItem>
                  <MenuItem value="adventure">Adventure</MenuItem>
                  <MenuItem value="spectator">Spectator</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* PvP */}
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.pvp ?? true}
                    onChange={(e) => handleChange('pvp', e.target.checked)}
                  />
                }
                label="Enable PvP"
              />
            </Grid>

            {/* View Distance */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="View Distance (chunks)"
                value={formData.viewDistance || 10}
                onChange={(e) => handleChange('viewDistance', parseInt(e.target.value, 10))}
                inputProps={{ min: 3, max: 32 }}
              />
            </Grid>

            {/* Spawn Protection */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Spawn Protection (blocks)"
                value={formData.spawnProtection || 16}
                onChange={(e) => handleChange('spawnProtection', parseInt(e.target.value, 10))}
                inputProps={{ min: 0, max: 128 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Performance Section */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Performance Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These settings require a server restart to take effect.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            {/* Memory */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Memory Allocation"
                value={formData.memory || '4G'}
                onChange={(e) => handleChange('memory', e.target.value)}
                helperText="Format: 4G, 8G, etc."
              />
            </Grid>

            {/* Aikar Flags */}
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.useAikarFlags ?? false}
                    onChange={(e) => handleChange('useAikarFlags', e.target.checked)}
                  />
                }
                label="Use Aikar's Flags (Optimized GC)"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!hasChanges || updateConfig.isPending}
          sx={{ px: 4 }}
        >
          {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      {/* Danger Zone */}
      <Card sx={{ borderRadius: 3, borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600} color="error">
            Danger Zone
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {/* Reset World */}
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

      {/* Reset World Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
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
          <Button onClick={() => setResetDialogOpen(false)}>
            Cancel
          </Button>
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
