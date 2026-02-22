'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import { useServers } from '@/hooks/useMcctl';
import { useConfigSnapshots } from '@/hooks/useConfigSnapshots';
import { useConfigSnapshotSchedules } from '@/hooks/useConfigSnapshotSchedules';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';
import { ConfigSnapshotServerList } from './ConfigSnapshotServerList';
import { CreateSnapshotDialog } from './CreateSnapshotDialog';
import { ConfigSnapshotSchedulePanel } from './ConfigSnapshotSchedulePanel';
import { ConfigDiffDialog } from './diff';

/**
 * Helper hook: fetch snapshots for multiple servers
 * Fetches the latest 5 snapshots per server for summary display
 */
function useMultiServerSnapshots(serverNames: string[]) {
  // We fetch snapshots for each server individually
  // This is a limitation but works well for the summary view
  const queries = serverNames.map((name) => ({
    name,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    query: useConfigSnapshots(name, 5, 0, { enabled: !!name }),
  }));

  const isLoading = queries.some((q) => q.query.isLoading);
  const error = queries.find((q) => q.query.error)?.query.error || null;

  const snapshotsByServer = useMemo(() => {
    const map = new Map<string, { snapshots: ConfigSnapshotItem[]; total: number }>();
    for (const q of queries) {
      if (q.query.data) {
        map.set(q.name, {
          snapshots: q.query.data.snapshots,
          total: q.query.data.total,
        });
      }
    }
    return map;
  }, [queries]);

  return { snapshotsByServer, isLoading, error };
}

/**
 * ConfigSnapshotTab - Main container for the Config Snapshots tab content.
 * Orchestrates server list, snapshot data fetching, schedule panel, and dialogs.
 */
export function ConfigSnapshotTab() {
  const { data: serversData, isLoading: serversLoading } = useServers();
  const servers = serversData?.servers ?? [];
  const serverNames = servers.map((s) => s.name);

  const { snapshotsByServer, isLoading: snapshotsLoading, error: snapshotsError } = useMultiServerSnapshots(serverNames);
  const { data: schedulesData } = useConfigSnapshotSchedules();
  const schedules = schedulesData?.schedules ?? [];

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaultServer, setCreateDefaultServer] = useState<string | undefined>(undefined);
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [diffServerName, setDiffServerName] = useState('');

  const handleViewHistory = (serverName: string) => {
    // For now, open a view of snapshots for this server
    // Could navigate to a detail page in the future
    const data = snapshotsByServer.get(serverName);
    if (data && data.snapshots.length > 0) {
      // Open diff dialog showing the latest two snapshots
      setDiffServerName(serverName);
      setDiffDialogOpen(true);
    }
  };

  const handleCreateSnapshot = (serverName: string) => {
    setCreateDefaultServer(serverName);
    setCreateDialogOpen(true);
  };

  const handleViewDiff = (serverName: string) => {
    setDiffServerName(serverName);
    setDiffDialogOpen(true);
  };

  // Get the two latest snapshots for diff
  const diffSnapshots = useMemo(() => {
    if (!diffServerName) return { snapshotA: null, snapshotB: null };
    const data = snapshotsByServer.get(diffServerName);
    if (!data || data.snapshots.length < 2) return { snapshotA: null, snapshotB: null };
    return {
      snapshotA: data.snapshots[1], // older (base)
      snapshotB: data.snapshots[0], // newer (compare)
    };
  }, [diffServerName, snapshotsByServer]);

  return (
    <>
      {/* Header actions */}
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
          onClick={() => {
            setCreateDefaultServer(undefined);
            setCreateDialogOpen(true);
          }}
        >
          Create Snapshot
        </Button>
      </Box>

      {/* Description */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Config snapshots capture server configuration files (server.properties, config.env, etc.)
        for versioning, comparison, and restore operations.
      </Typography>

      {/* Server list with snapshot summaries */}
      <ConfigSnapshotServerList
        servers={servers}
        snapshotsByServer={snapshotsByServer}
        schedules={schedules}
        isLoading={serversLoading || snapshotsLoading}
        error={snapshotsError}
        onViewHistory={handleViewHistory}
        onCreateSnapshot={handleCreateSnapshot}
        onViewDiff={handleViewDiff}
      />

      {/* Create snapshot dialog */}
      <CreateSnapshotDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateDefaultServer(undefined);
        }}
        serverNames={serverNames}
        defaultServer={createDefaultServer}
      />

      {/* Schedule management panel */}
      <ConfigSnapshotSchedulePanel
        open={schedulePanelOpen}
        onClose={() => setSchedulePanelOpen(false)}
        serverNames={serverNames}
      />

      {/* Diff dialog (from #404) */}
      {diffDialogOpen && diffSnapshots.snapshotA && diffSnapshots.snapshotB && (
        <ConfigDiffDialog
          open={diffDialogOpen}
          onClose={() => {
            setDiffDialogOpen(false);
            setDiffServerName('');
          }}
          snapshotA={diffSnapshots.snapshotA}
          snapshotB={diffSnapshots.snapshotB}
        />
      )}
    </>
  );
}
