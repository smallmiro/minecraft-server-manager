'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { CreateWorldRequest } from '@/ports/api/IMcctlApiClient';

interface CreateWorldDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWorldRequest) => void;
  loading?: boolean;
}

const DEFAULT_FORM_VALUES: CreateWorldRequest = {
  name: '',
  seed: '',
};

export function CreateWorldDialog({
  open,
  onClose,
  onSubmit,
  loading = false,
}: CreateWorldDialogProps) {
  const [formData, setFormData] = useState<CreateWorldRequest>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setFormData(DEFAULT_FORM_VALUES);
      setErrors({});
    }
  }, [open]);

  const validateName = (name: string): string | null => {
    if (!name) {
      return 'World name is required';
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      return 'Only lowercase letters, numbers, and hyphens are allowed';
    }
    return null;
  };

  const handleChange = (field: keyof CreateWorldRequest) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setErrors({});

    const nameError = validateName(formData.name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    onSubmit({
      name: formData.name,
      ...(formData.seed ? { seed: formData.seed } : {}),
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New World</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="World Name"
              value={formData.name}
              onChange={handleChange('name')}
              error={!!errors.name}
              helperText={errors.name || 'Only lowercase letters, numbers, and hyphens'}
              fullWidth
              autoFocus
              disabled={loading}
            />

            <TextField
              label="Seed (optional)"
              value={formData.seed || ''}
              onChange={handleChange('seed')}
              helperText="Leave empty for a random seed"
              fullWidth
              disabled={loading}
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
