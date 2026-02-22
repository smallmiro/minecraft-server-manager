'use client';

import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { BackupStatus, BackupHistory, BackupPushButton, BackupScheduleList } from '@/components/backups';
import { useBackupStatus } from '@/hooks/useMcctl';

export default function BackupsPage() {
  const { data: statusData } = useBackupStatus();
  const configured = statusData?.configured ?? false;

  return (
    <>
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'secondary.main',
              color: 'secondary.contrastText',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Backups
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage world backups and restore points
            </Typography>
          </Box>
        </Box>
        <BackupPushButton disabled={!configured} />
      </Paper>

      {/* Content */}
      <Stack spacing={3}>
        {/* Backup Status */}
        <BackupStatus />

        {/* Backup Schedules */}
        <BackupScheduleList />

        {/* Backup History */}
        {configured && <BackupHistory />}
      </Stack>
    </>
  );
}
