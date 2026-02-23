'use client';

import { useMemo } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import type { ServerSummary, ConfigSnapshotItem, ConfigSnapshotScheduleItem } from '@/ports/api/IMcctlApiClient';
import { ConfigSnapshotServerCard } from './ConfigSnapshotServerCard';

interface ServerSnapshotData {
  serverName: string;
  snapshots: ConfigSnapshotItem[];
  totalCount: number;
  schedule?: ConfigSnapshotScheduleItem;
}

interface ConfigSnapshotServerListProps {
  servers: ServerSummary[];
  snapshotsByServer: Map<string, { snapshots: ConfigSnapshotItem[]; total: number }>;
  schedules: ConfigSnapshotScheduleItem[];
  isLoading: boolean;
  error?: Error | null;
  onViewHistory: (serverName: string) => void;
  onCreateSnapshot: (serverName: string) => void;
  onViewDiff: (serverName: string) => void;
}

/**
 * ConfigSnapshotServerList - List of servers with snapshot summary cards.
 * Groups snapshots by server and displays schedule information.
 */
export function ConfigSnapshotServerList({
  servers,
  snapshotsByServer,
  schedules,
  isLoading,
  error,
  onViewHistory,
  onCreateSnapshot,
  onViewDiff,
}: ConfigSnapshotServerListProps) {
  // Build server data with snapshots and schedules
  const serverData: ServerSnapshotData[] = useMemo(() => {
    return servers.map((server) => {
      const data = snapshotsByServer.get(server.name);
      const serverSchedule = schedules.find(
        (s) => s.serverName === server.name
      );

      return {
        serverName: server.name,
        snapshots: data?.snapshots ?? [],
        totalCount: data?.total ?? 0,
        schedule: serverSchedule,
      };
    });
  }, [servers, snapshotsByServer, schedules]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load config snapshots: {error.message}
      </Alert>
    );
  }

  if (servers.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <SettingsBackupRestoreIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          No servers found
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Create a server to start taking config snapshots
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {serverData.map((data) => (
        <ConfigSnapshotServerCard
          key={data.serverName}
          serverName={data.serverName}
          snapshots={data.snapshots}
          totalCount={data.totalCount}
          schedule={data.schedule}
          onViewHistory={onViewHistory}
          onCreateSnapshot={onCreateSnapshot}
          onViewDiff={onViewDiff}
        />
      ))}
    </Stack>
  );
}
