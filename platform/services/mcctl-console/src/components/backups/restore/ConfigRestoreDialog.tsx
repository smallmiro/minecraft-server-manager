'use client';

import { useState, useCallback } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RestoreIcon from '@mui/icons-material/Restore';
import { useRestoreConfigSnapshot } from '@/hooks/useRestoreConfigSnapshot';
import { useConfigSnapshotDiff } from '@/hooks/useConfigSnapshotDiff';
import { ConfigRestoreChangeList } from './ConfigRestoreChangeList';
import { ConfigRestoreConfirm } from './ConfigRestoreConfirm';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

interface ConfigRestoreDialogProps {
  open: boolean;
  serverName: string;
  snapshot: ConfigSnapshotItem;
  /** Current snapshot ID to compare against (for showing changes) */
  currentSnapshotId?: string;
  /** Whether the server is currently running */
  isServerRunning?: boolean;
  onClose: () => void;
  onSuccess?: (data: { restored: ConfigSnapshotItem; safetySnapshot?: ConfigSnapshotItem }) => void;
}

/**
 * Restore confirmation dialog for config snapshot restoration
 * Shows what changes will be applied and allows creating a safety snapshot
 */
export function ConfigRestoreDialog({
  open,
  serverName,
  snapshot,
  currentSnapshotId,
  isServerRunning = false,
  onClose,
  onSuccess,
}: ConfigRestoreDialogProps) {
  const [createSafetySnapshot, setCreateSafetySnapshot] = useState(true);
  const [successData, setSuccessData] = useState<{
    restored: ConfigSnapshotItem;
    safetySnapshot?: ConfigSnapshotItem;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const { mutate: restoreSnapshot, isPending } = useRestoreConfigSnapshot();

  // Fetch diff to show what changes will be applied
  const { data: diffData, isLoading: isDiffLoading } = useConfigSnapshotDiff(
    currentSnapshotId ?? '',
    snapshot.id,
    { enabled: open && !!currentSnapshotId }
  );

  const handleRestore = useCallback(() => {
    setErrorMessage('');
    setSuccessData(null);

    restoreSnapshot(
      {
        serverName,
        snapshotId: snapshot.id,
        options: {
          createSnapshotBeforeRestore: createSafetySnapshot,
          force: isServerRunning, // Force if server is running
        },
      },
      {
        onSuccess: (data) => {
          setSuccessData(data);
          onSuccess?.(data);
        },
        onError: (error) => {
          setErrorMessage(error.message || 'Failed to restore configuration');
        },
      }
    );
  }, [serverName, snapshot.id, createSafetySnapshot, isServerRunning, restoreSnapshot, onSuccess]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      setErrorMessage('');
      setSuccessData(null);
      setCreateSafetySnapshot(true);
      onClose();
    }
  }, [isPending, onClose]);

  const handleSuccessClose = useCallback(() => {
    setSuccessData(null);
    setCreateSafetySnapshot(true);
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="config-restore-dialog-title"
    >
      <DialogTitle
        id="config-restore-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <WarningAmberIcon color="warning" />
        Restore Configuration
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {/* Success state */}
        {successData && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="success">
              <AlertTitle>Configuration restored successfully</AlertTitle>
              <Typography variant="body2">
                Server <strong>{serverName}</strong> has been restored to the snapshot from{' '}
                {formatDateTime(snapshot.createdAt)}.
              </Typography>
              {successData.safetySnapshot && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Safety snapshot created: ID{' '}
                  <code>{successData.safetySnapshot.id.substring(0, 8)}...</code>
                </Typography>
              )}
            </Alert>
            {isServerRunning && (
              <Alert severity="info">
                Restart the server for changes to take effect.
              </Alert>
            )}
          </Box>
        )}

        {/* Normal state */}
        {!successData && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Server
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {serverName}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Restore to
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {snapshot.description
                  ? `"${snapshot.description}"`
                  : 'Unnamed snapshot'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(snapshot.createdAt)}
              </Typography>
            </Box>

            {/* Change list */}
            {currentSnapshotId && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  The following changes will be applied:
                </Typography>
                {isDiffLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Loading changes...
                    </Typography>
                  </Box>
                ) : diffData ? (
                  <ConfigRestoreChangeList changes={diffData.changes} />
                ) : null}
              </Box>
            )}

            {!currentSnapshotId && (
              <Alert severity="info">
                All configuration files in this snapshot will be restored.
                {snapshot.files.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {snapshot.files.length} file(s) will be applied.
                  </Typography>
                )}
              </Alert>
            )}

            {/* Error message */}
            {errorMessage && (
              <Alert severity="error">
                {errorMessage}
              </Alert>
            )}

            <Divider />

            {/* Confirm section */}
            <ConfigRestoreConfirm
              serverName={serverName}
              isServerRunning={isServerRunning}
              createSafetySnapshot={createSafetySnapshot}
              onCreateSafetySnapshotChange={setCreateSafetySnapshot}
            />
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        {successData ? (
          <Button onClick={handleSuccessClose} variant="contained">
            Close
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              variant="contained"
              color="warning"
              disabled={isPending}
              startIcon={
                isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RestoreIcon />
                )
              }
            >
              {isPending ? 'Restoring...' : 'Restore Configuration'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
