'use client';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

interface RestartRouterDialogProps {
  open: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestartRouterDialog({ open, pending = false, onConfirm, onCancel }: RestartRouterDialogProps) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Restart mc-router?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Players connected through mc-router will be disconnected, and new connections fail until it is back up.
          Running servers are not stopped.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit" disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          disabled={pending}
          startIcon={pending ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Restart
        </Button>
      </DialogActions>
    </Dialog>
  );
}
