'use client';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { BackupStatus, BackupHistory, BackupPushButton } from '@/components/backups';
import { useBackupStatus } from '@/hooks/useMcctl';

export default function BackupsPage() {
  const { data: statusData } = useBackupStatus();
  const configured = statusData?.configured ?? false;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Backups
        </Typography>
        <BackupPushButton disabled={!configured} />
      </Box>

      {/* Content */}
      <Stack spacing={3}>
        {/* Backup Status */}
        <BackupStatus />

        {/* Backup History */}
        {configured && <BackupHistory />}
      </Stack>
    </Container>
  );
}
