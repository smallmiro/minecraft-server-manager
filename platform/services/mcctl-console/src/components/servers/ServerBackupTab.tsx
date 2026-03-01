'use client';

import { useState, useMemo } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  BackupStatus,
  BackupHistory,
  BackupPushButton,
  BackupScheduleList,
  ConfigSnapshotServerCard,
  CreateSnapshotDialog,
  ConfigSnapshotSchedulePanel,
  type BackupTabValue,
} from '@/components/backups';
import { ConfigDiffDialog } from '@/components/backups/diff';
import { useBackupStatus } from '@/hooks/useMcctl';
import { useConfigSnapshots } from '@/hooks/useConfigSnapshots';
import { useConfigSnapshotSchedules } from '@/hooks/useConfigSnapshotSchedules';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

interface ServerBackupTabProps {
  serverName: string;
}

export function ServerBackupTab({ serverName }: ServerBackupTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<BackupTabValue>('config-snapshots');
  const { data: statusData } = useBackupStatus();
  const configured = statusData?.configured ?? false;

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeSubTab}
          onChange={(_, newValue: BackupTabValue) => setActiveSubTab(newValue)}
          aria-label="Server backup tabs"
        >
          <Tab
            value="config-snapshots"
            label="Config Snapshots"
            icon={<SettingsBackupRestoreIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 'medium' }}
          />
          <Tab
            value="world-backups"
            label="World Backups"
            icon={<CloudUploadIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 'medium' }}
          />
        </Tabs>
      </Box>

      {activeSubTab === 'config-snapshots' && (
        <ConfigSnapshotsContent serverName={serverName} />
      )}

      {activeSubTab === 'world-backups' && (
        <WorldBackupsContent configured={configured} />
      )}
    </Box>
  );
}

function WorldBackupsContent({ configured }: { configured: boolean }) {
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BackupPushButton disabled={!configured} />
      </Box>
      <BackupStatus />
      <BackupScheduleList />
      {configured && <BackupHistory />}
    </Stack>
  );
}

function ConfigSnapshotsContent({ serverName }: { serverName: string }) {
  const { data: snapshotsData, isLoading: snapshotsLoading, error: snapshotsError } = useConfigSnapshots(serverName, 5, 0);
  const { data: schedulesData } = useConfigSnapshotSchedules(serverName);
  const schedules = schedulesData?.schedules ?? [];

  const snapshots = snapshotsData?.snapshots ?? [];
  const totalCount = snapshotsData?.total ?? 0;
  const schedule = schedules.find((s) => s.serverName === serverName);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);

  const diffSnapshots = useMemo(() => {
    if (snapshots.length < 2) return { snapshotA: null, snapshotB: null };
    return {
      snapshotA: snapshots[1] as ConfigSnapshotItem,
      snapshotB: snapshots[0] as ConfigSnapshotItem,
    };
  }, [snapshots]);

  if (snapshotsLoading) {
    return (
      <Typography color="text.secondary">Loading config snapshots...</Typography>
    );
  }

  if (snapshotsError) {
    return (
      <Typography color="error">Failed to load config snapshots</Typography>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SettingsIcon />}
          onClick={() => setSchedulePanelOpen(true)}
        >
          Manage Schedules
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Snapshot
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Config snapshots capture server configuration files (server.properties, config.env, etc.)
        for versioning, comparison, and restore operations.
      </Typography>

      <ConfigSnapshotServerCard
        serverName={serverName}
        snapshots={snapshots}
        totalCount={totalCount}
        schedule={schedule}
        onViewHistory={() => {
          // Button is disabled in ConfigSnapshotServerCard when totalCount < 2,
          // but keep this guard as defensive code
          if (snapshots.length >= 2) {
            setDiffDialogOpen(true);
          }
        }}
        onCreateSnapshot={() => setCreateDialogOpen(true)}
        onViewDiff={() => setDiffDialogOpen(true)}
      />

      <CreateSnapshotDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        serverNames={[serverName]}
        defaultServer={serverName}
      />

      <ConfigSnapshotSchedulePanel
        open={schedulePanelOpen}
        onClose={() => setSchedulePanelOpen(false)}
        serverNames={[serverName]}
        filterServerName={serverName}
      />

      {diffDialogOpen && diffSnapshots.snapshotA && diffSnapshots.snapshotB && (
        <ConfigDiffDialog
          open={diffDialogOpen}
          onClose={() => setDiffDialogOpen(false)}
          snapshotA={diffSnapshots.snapshotA}
          snapshotB={diffSnapshots.snapshotB}
        />
      )}
    </>
  );
}
