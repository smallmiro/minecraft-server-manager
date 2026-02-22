'use client';

import { useState } from 'react';
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
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useCreateConfigSnapshot } from '@/hooks/useConfigSnapshots';

interface CreateSnapshotDialogProps {
  open: boolean;
  onClose: () => void;
  serverNames: string[];
  /** Pre-selected server name */
  defaultServer?: string;
}

/**
 * CreateSnapshotDialog - Modal dialog for creating a new config snapshot.
 * Allows server selection and optional description input.
 */
export function CreateSnapshotDialog({
  open,
  onClose,
  serverNames,
  defaultServer,
}: CreateSnapshotDialogProps) {
  const [selectedServer, setSelectedServer] = useState(defaultServer || '');
  const [description, setDescription] = useState('');

  const createMutation = useCreateConfigSnapshot();

  const handleSubmit = async () => {
    if (!selectedServer) return;

    try {
      await createMutation.mutateAsync({
        serverName: selectedServer,
        description: description.trim() || undefined,
      });
      handleClose();
    } catch {
      // Error is handled by mutation state
    }
  };

  const handleClose = () => {
    if (createMutation.isPending) return;
    setSelectedServer(defaultServer || '');
    setDescription('');
    createMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Config Snapshot</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel>Server</InputLabel>
            <Select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              label="Server"
              disabled={createMutation.isPending || !!defaultServer}
            >
              {serverNames.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Before modpack update"
            fullWidth
            disabled={createMutation.isPending}
          />

          {createMutation.isError && (
            <Alert severity="error">
              {createMutation.error?.message || 'Failed to create snapshot'}
            </Alert>
          )}

          {createMutation.isPending && (
            <Alert severity="info" icon={<CircularProgress size={20} />}>
              Creating snapshot... This may take a moment.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedServer || createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Snapshot'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
