'use client';

import { useCallback } from 'react';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  BackupStatus,
  BackupHistory,
  BackupPushButton,
  BackupScheduleList,
  BackupPageTabs,
  ConfigSnapshotTab,
  type BackupTabValue,
} from '@/components/backups';
import { useBackupStatus } from '@/hooks/useMcctl';
import { useSearchParams, useRouter } from 'next/navigation';
import { BentoPanel, PageHero } from '@/components/bento';

export default function BackupsPage() {
  const { data: statusData, isLoading: statusLoading, error: statusError } = useBackupStatus();
  const configured = statusData?.configured ?? false;
  const configurationLabel = statusLoading
    ? 'Checking backup configuration'
    : statusError || !statusData
      ? 'Unavailable'
    : configured
      ? 'Configured'
      : 'Not configured';

  const searchParams = useSearchParams();
  const router = useRouter();

  // Read tab from URL query parameter, default to 'world-backups'
  const currentTab = (searchParams.get('tab') as BackupTabValue) || 'world-backups';

  const handleTabChange = useCallback(
    (newTab: BackupTabValue) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newTab === 'world-backups') {
        params.delete('tab');
      } else {
        params.set('tab', newTab);
      }
      const query = params.toString();
      router.push(query ? `/backups?${query}` : '/backups');
    },
    [searchParams, router]
  );

  return (
    <>
      <PageHero
        compact
        title="Backups"
        description="Manage world backups and config snapshots"
        eyebrow="Recovery"
        icon={<CloudUploadIcon />}
        status={(
          <Chip
            label={configurationLabel}
            color={statusLoading ? 'default' : statusError || !statusData ? 'error' : configured ? 'success' : 'warning'}
            size="small"
          />
        )}
        actions={currentTab === 'world-backups' ? (
          <BackupPushButton disabled={!configured || statusLoading || Boolean(statusError)} />
        ) : undefined}
        sx={{ mb: 2.5 }}
      />

      {statusError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          Failed to load backup status: {statusError.message}
        </Alert>
      )}

      {/* Tab Switcher */}
      <BentoPanel sx={{ p: 1, mb: 2.5 }}>
        <BackupPageTabs value={currentTab} onChange={handleTabChange} />
      </BentoPanel>

      {/* Tab Content */}
      <BentoPanel
        role="region"
        aria-label="Backup content"
        sx={{ p: { xs: 2, sm: 3 }, minHeight: 360 }}
      >
        {currentTab === 'world-backups' && (
          <Stack spacing={3}>
            <BackupStatus />

            <BackupScheduleList />

            {configured && <BackupHistory />}
          </Stack>
        )}

        {currentTab === 'config-snapshots' && (
          <ConfigSnapshotTab />
        )}
      </BentoPanel>
    </>
  );
}
