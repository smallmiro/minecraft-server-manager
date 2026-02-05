'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';
import type { CreateServerStatus } from '@/hooks/useCreateServerSSE';

interface CreateServerDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateServerRequest) => void;
  loading?: boolean;
  status?: CreateServerStatus;
  progress?: number;
  message?: string;
}

const SERVER_TYPES = ['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'NEOFORGE'];

const DEFAULT_FORM_VALUES: CreateServerRequest = {
  name: '',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  autoStart: false,
  sudoPassword: '',
};

const PROGRESS_STEPS = [
  { key: 'initializing', label: 'Initializing' },
  { key: 'creating', label: 'Creating' },
  { key: 'configuring', label: 'Configuring' },
  { key: 'starting', label: 'Starting' },
];

export function CreateServerDialog({
  open,
  onClose,
  onSubmit,
  loading = false,
  status = 'idle',
  progress = 0,
  message = '',
}: CreateServerDialogProps) {
  const [formData, setFormData] = useState<CreateServerRequest>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Determine active step based on status
  const activeStep = PROGRESS_STEPS.findIndex((step) => step.key === status);
  const isCreating = status !== 'idle' && status !== 'completed' && status !== 'error';

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData(DEFAULT_FORM_VALUES);
      setErrors({});
    }
  }, [open]);

  const validateName = (name: string): string | null => {
    if (!name) {
      return 'Server name is required';
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      return 'Only lowercase letters, numbers, and hyphens are allowed';
    }
    return null;
  };

  const handleChange = (field: keyof CreateServerRequest) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleCheckboxChange = (field: keyof CreateServerRequest) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clear existing errors
    setErrors({});

    // Validate
    const nameError = validateName(formData.name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    // Submit
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={isCreating ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {status === 'completed' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              Server Created Successfully
            </Box>
          ) : status === 'error' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              Creation Failed
            </Box>
          ) : (
            'Create New Server'
          )}
        </DialogTitle>
        <DialogContent>
          {isCreating || status === 'completed' || status === 'error' ? (
            <Box sx={{ py: 2 }}>
              {/* Progress Stepper */}
              <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                {PROGRESS_STEPS.map((step) => (
                  <Step key={step.key}>
                    <StepLabel>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {/* Progress Bar */}
              {isCreating && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {message}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {progress}%
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
              )}

              {/* Completion/Error Message */}
              {status === 'completed' && (
                <Typography color="success.main" sx={{ textAlign: 'center' }}>
                  {message}
                </Typography>
              )}
              {status === 'error' && (
                <Typography color="error.main" sx={{ textAlign: 'center' }}>
                  {message}
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Server Name"
                value={formData.name}
                onChange={handleChange('name')}
                error={!!errors.name}
                helperText={errors.name || 'Only lowercase letters, numbers, and hyphens'}
                fullWidth
                autoFocus
                disabled={isCreating}
              />

              <TextField
                label="Server Type"
                select
                value={formData.type}
                onChange={handleChange('type')}
                fullWidth
                disabled={isCreating}
              >
                {SERVER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Minecraft Version"
                value={formData.version}
                onChange={handleChange('version')}
                helperText="e.g., 1.21.1, 1.20.4, latest"
                fullWidth
                disabled={isCreating}
              />

              <TextField
                label="Memory"
                value={formData.memory}
                onChange={handleChange('memory')}
                helperText="e.g., 4G, 8G, 16G"
                fullWidth
                disabled={isCreating}
              />

              <TextField
                label="Sudo Password"
                type="password"
                value={formData.sudoPassword || ''}
                onChange={handleChange('sudoPassword')}
                helperText="Required for mDNS hostname registration (avahi)"
                fullWidth
                disabled={isCreating}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.autoStart || false}
                    onChange={handleCheckboxChange('autoStart')}
                    disabled={isCreating}
                  />
                }
                label="Auto-start after creation"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {status === 'completed' || status === 'error' ? (
            <Button onClick={onClose} variant="contained" fullWidth>
              Close
            </Button>
          ) : (
            <>
              <Button onClick={onClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isCreating}
                startIcon={isCreating ? <CircularProgress size={16} /> : null}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
