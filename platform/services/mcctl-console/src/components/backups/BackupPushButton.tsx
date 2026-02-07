'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import BackupIcon from '@mui/icons-material/Backup';
import { usePushBackup } from '@/hooks/useMcctl';

interface BackupPushButtonProps {
  disabled?: boolean;
}

export function BackupPushButton({ disabled }: BackupPushButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { mutate: pushBackup, isPending } = usePushBackup();

  const handleOpen = () => {
    setOpen(true);
    setSuccessMessage('');
    setErrorMessage('');
    setMessage(`Backup ${new Date().toISOString().split('T')[0]}`);
  };

  const handleClose = () => {
    if (!isPending) {
      setOpen(false);
      setMessage('');
      setSuccessMessage('');
      setErrorMessage('');
    }
  };

  const handlePush = () => {
    setSuccessMessage('');
    setErrorMessage('');

    pushBackup(
      { message: message || undefined },
      {
        onSuccess: (data) => {
          setSuccessMessage(
            data.commitHash
              ? `Backup pushed successfully (${data.commitHash.substring(0, 7)})`
              : 'Backup pushed successfully'
          );
          setTimeout(() => {
            handleClose();
          }, 2000);
        },
        onError: (error) => {
          setErrorMessage(`Failed to push backup: ${error.message}`);
        },
      }
    );
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<BackupIcon />}
        onClick={handleOpen}
        disabled={disabled || isPending}
      >
        Push Backup
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Push Backup</DialogTitle>
        <DialogContent>
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <TextField
            autoFocus
            margin="dense"
            label="Commit Message"
            type="text"
            fullWidth
            variant="outlined"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isPending}
            helperText="Optional message describing this backup"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handlePush}
            variant="contained"
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} /> : <BackupIcon />}
          >
            {isPending ? 'Pushing...' : 'Push'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
