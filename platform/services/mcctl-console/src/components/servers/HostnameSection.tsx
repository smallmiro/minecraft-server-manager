'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import LockIcon from '@mui/icons-material/Lock';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LanguageIcon from '@mui/icons-material/Language';
import CloseIcon from '@mui/icons-material/Close';
import { useServerHostnames, useUpdateHostnames } from '@/hooks/useMcctl';

interface HostnameSectionProps {
  serverName: string;
}

export function HostnameSection({ serverName }: HostnameSectionProps) {
  const { data, isLoading } = useServerHostnames(serverName);
  const updateHostnames = useUpdateHostnames();

  const [customDomains, setCustomDomains] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainError, setNewDomainError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning';
  }>({ open: false, message: '', severity: 'success' });

  // Sync state from API data
  useEffect(() => {
    if (data?.customHostnames) {
      setCustomDomains(data.customHostnames);
      setHasChanges(false);
      setSavedSuccess(false);
    }
  }, [data]);

  const validateDomain = (domain: string): string => {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) return 'Domain cannot be empty';
    if (trimmed.length > 253) return 'Domain exceeds 253 characters';

    const hostnamePattern = /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/;
    if (!hostnamePattern.test(trimmed)) return 'Invalid domain format';

    if (trimmed.endsWith('.local')) return 'Cannot use .local system domain';
    if (trimmed.endsWith('.nip.io')) return 'Cannot use .nip.io system domain';

    if (customDomains.includes(trimmed)) return 'Domain already exists';

    return '';
  };

  const handleAddDomain = () => {
    const trimmed = newDomain.trim().toLowerCase();
    const error = validateDomain(trimmed);

    if (error) {
      setNewDomainError(error);
      return;
    }

    setCustomDomains((prev) => [...prev, trimmed]);
    setNewDomain('');
    setNewDomainError('');
    setIsAdding(false);
    setHasChanges(true);
  };

  const handleRemoveDomain = (domain: string) => {
    setCustomDomains((prev) => prev.filter((d) => d !== domain));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateHostnames.mutateAsync({
        serverName,
        customHostnames: customDomains,
      });

      setHasChanges(false);
      setSavedSuccess(true);
      setSnackbar({
        open: true,
        message: 'Hostnames saved. Container recreation required to apply changes.',
        severity: 'warning',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save hostnames',
        severity: 'error',
      });
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewDomain('');
    setNewDomainError('');
  };

  if (isLoading) {
    return (
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LanguageIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Hostnames / Domains
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage hostnames used by mc-router to route connections to this server.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {/* System Hostnames */}
          {data?.systemHostnames && data.systemHostnames.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                System Hostnames (read-only)
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {data.systemHostnames.map((h) => (
                  <Chip
                    key={h.hostname}
                    icon={<LockIcon sx={{ fontSize: 16 }} />}
                    label={h.hostname}
                    title={h.description}
                    variant="outlined"
                    color="default"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Custom Domains */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Custom Domains
            </Typography>

            {customDomains.length === 0 && !isAdding && (
              <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
                No custom domains configured.
              </Typography>
            )}

            <Stack spacing={1}>
              {customDomains.map((domain) => (
                <Box
                  key={domain}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 0.5,
                    px: 1.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="body2" fontFamily='"Roboto Mono", monospace'>
                    {domain}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveDomain(domain)}
                    title="Remove domain"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>

            {/* Add Domain Inline */}
            {isAdding ? (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1 }}>
                <TextField
                  size="small"
                  placeholder="e.g. play.example.com"
                  value={newDomain}
                  onChange={(e) => {
                    setNewDomain(e.target.value);
                    setNewDomainError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddDomain();
                    if (e.key === 'Escape') handleCancelAdd();
                  }}
                  error={!!newDomainError}
                  helperText={newDomainError}
                  autoFocus
                  sx={{ flex: 1 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAddDomain}
                >
                  Add
                </Button>
                <IconButton size="small" onClick={handleCancelAdd}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setIsAdding(true)}
                sx={{ mt: 1 }}
              >
                Add Domain
              </Button>
            )}
          </Box>

          {/* Recreate Warning */}
          {savedSuccess && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Container recreation is required for hostname changes to take effect.
              Run <code>docker compose up -d</code> or restart the server from the dashboard.
            </Alert>
          )}

          {/* Save Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!hasChanges || updateHostnames.isPending}
            >
              {updateHostnames.isPending ? 'Saving...' : 'Save Hostnames'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
