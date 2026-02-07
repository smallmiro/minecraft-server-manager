'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import RestoreIcon from '@mui/icons-material/Restore';
import { useRestoreBackup } from '@/hooks/useMcctl';
import type { BackupCommit } from '@/ports/api/IMcctlApiClient';

/**
 * Format timestamp to detailed date time
 */
function formatFullDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

interface BackupRestoreDialogProps {
  open: boolean;
  commit: BackupCommit;
  onClose: () => void;
}

export function BackupRestoreDialog({ open, commit, onClose }: BackupRestoreDialogProps) {
  const { mutate: restoreBackup, isPending } = useRestoreBackup();
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRestore = () => {
    setSuccessMessage('');
    setErrorMessage('');

    restoreBackup(commit.hash, {
      onSuccess: () => {
        setSuccessMessage(`Backup restored successfully from ${commit.hash.substring(0, 7)}`);
        setTimeout(() => {
          onClose();
        }, 2000);
      },
      onError: (error) => {
        setErrorMessage(`Failed to restore backup: ${error.message}`);
      },
    });
  };

  const handleClose = () => {
    if (!isPending) {
      setSuccessMessage('');
      setErrorMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Restore Backup</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This will restore all worlds from the selected backup. Current world data will be
          overwritten.
        </Alert>

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

        <DialogContentText sx={{ mb: 2 }}>
          Are you sure you want to restore from this backup?
        </DialogContentText>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Commit Hash
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
            >
              {commit.hash}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Date
            </Typography>
            <Typography variant="body2">{formatFullDateTime(commit.date)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Message
            </Typography>
            <Typography variant="body2">{commit.message}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Author
            </Typography>
            <Typography variant="body2">{commit.author}</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleRestore}
          variant="contained"
          color="warning"
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <RestoreIcon />}
        >
          {isPending ? 'Restoring...' : 'Restore'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
