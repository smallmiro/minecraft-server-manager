'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useBackupStatus } from '@/hooks/useMcctl';

/**
 * Format relative time from timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

export function BackupStatus() {
  const { data, isLoading, error } = useBackupStatus();

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup Status
          </Typography>
          <Typography color="text.secondary">Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup Status
          </Typography>
          <Typography color="error">Failed to load backup status</Typography>
        </CardContent>
      </Card>
    );
  }

  const { configured, lastBackup, repository } = data || {};

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Backup Status</Typography>
          <Chip
            icon={configured ? <CheckCircleIcon /> : <ErrorIcon />}
            label={configured ? 'Configured' : 'Not Configured'}
            color={configured ? 'success' : 'error'}
            size="small"
          />
        </Box>

        {configured ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {repository && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Repository
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {repository}
                </Typography>
              </Box>
            )}
            {lastBackup && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Last Backup
                </Typography>
                <Typography variant="body2">
                  {formatRelativeTime(lastBackup)}
                </Typography>
              </Box>
            )}
            {!lastBackup && (
              <Typography variant="body2" color="text.secondary">
                No backups yet
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            GitHub backup is not configured. Please configure BACKUP_REPO_URL in your environment.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
