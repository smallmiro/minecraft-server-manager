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
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';

interface CreateServerDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateServerRequest) => void;
  loading?: boolean;
}

const SERVER_TYPES = ['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'NEOFORGE'];

const DEFAULT_FORM_VALUES: CreateServerRequest = {
  name: '',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  autoStart: false,
};

export function CreateServerDialog({ open, onClose, onSubmit, loading = false }: CreateServerDialogProps) {
  const [formData, setFormData] = useState<CreateServerRequest>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Server</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Server Name"
              value={formData.name}
              onChange={handleChange('name')}
              error={!!errors.name}
              helperText={errors.name || 'Only lowercase letters, numbers, and hyphens'}
              fullWidth
              autoFocus
            />

            <TextField
              label="Server Type"
              select
              value={formData.type}
              onChange={handleChange('type')}
              fullWidth
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
            />

            <TextField
              label="Memory"
              value={formData.memory}
              onChange={handleChange('memory')}
              helperText="e.g., 4G, 8G, 16G"
              fullWidth
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.autoStart || false}
                  onChange={handleCheckboxChange('autoStart')}
                />
              }
              label="Auto-start after creation"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
