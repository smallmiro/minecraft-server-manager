'use client';

import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface ConfigRestoreConfirmProps {
  serverName: string;
  isServerRunning: boolean;
  createSafetySnapshot: boolean;
  onCreateSafetySnapshotChange: (value: boolean) => void;
}

/**
 * Confirmation section with safety snapshot option and server running warning
 */
export function ConfigRestoreConfirm({
  serverName,
  isServerRunning,
  createSafetySnapshot,
  onCreateSafetySnapshotChange,
}: ConfigRestoreConfirmProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={createSafetySnapshot}
            onChange={(e) => onCreateSafetySnapshotChange(e.target.checked)}
            size="small"
          />
        }
        label={
          <Box>
            <Typography variant="body2">
              Create safety snapshot before restoring (recommended)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              A backup of the current configuration will be saved before applying changes
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', ml: 0 }}
      />

      {isServerRunning && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          <Typography variant="body2">
            Server <strong>{serverName}</strong> is currently running. A restart may be required
            for configuration changes to take effect.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
