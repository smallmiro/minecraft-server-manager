'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useServers } from '@/hooks/useMcctl';

interface AssignWorldDialogProps {
  open: boolean;
  worldName: string;
  onClose: () => void;
  onSubmit: (worldName: string, serverName: string) => void;
  loading?: boolean;
}

export function AssignWorldDialog({
  open,
  worldName,
  onClose,
  onSubmit,
  loading = false,
}: AssignWorldDialogProps) {
  const [selectedServer, setSelectedServer] = useState('');
  const { data: serversData, isLoading: serversLoading } = useServers();

  useEffect(() => {
    if (!open) {
      setSelectedServer('');
    }
  }, [open]);

  const servers = serversData?.servers || [];
  const stoppedServers = servers.filter(
    (s) => s.status === 'stopped' || s.status === 'exited'
  );
  const runningServers = servers.filter((s) => s.status === 'running');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) return;
    onSubmit(worldName, selectedServer);
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Assign World: {worldName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {serversLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : servers.length === 0 ? (
              <Typography color="text.secondary">
                No servers available. Create a server first.
              </Typography>
            ) : (
              <>
                {stoppedServers.length === 0 && runningServers.length > 0 && (
                  <Alert severity="warning">
                    All servers are currently running. It is recommended to assign worlds to stopped servers.
                  </Alert>
                )}

                <TextField
                  label="Select Server"
                  select
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  fullWidth
                  disabled={loading}
                  helperText="Select a server to assign this world to"
                >
                  {stoppedServers.length > 0 && (
                    <MenuItem disabled>
                      <Typography variant="caption" color="text.secondary">
                        Stopped Servers
                      </Typography>
                    </MenuItem>
                  )}
                  {stoppedServers.map((server) => (
                    <MenuItem key={server.name} value={server.name}>
                      {server.name}
                    </MenuItem>
                  ))}
                  {runningServers.length > 0 && (
                    <MenuItem disabled>
                      <Typography variant="caption" color="text.secondary">
                        Running Servers (not recommended)
                      </Typography>
                    </MenuItem>
                  )}
                  {runningServers.map((server) => (
                    <MenuItem key={server.name} value={server.name}>
                      {server.name}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !selectedServer || serversLoading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
