'use client';

import { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';
import { useServerConfigSnapshots } from '@/hooks/useServerConfigSnapshots';
import { useDeleteConfigSnapshot } from '@/hooks/useDeleteConfigSnapshot';
import { CreateSnapshotDialog } from '@/components/backups/CreateSnapshotDialog';
import { ConfigDiffDialog } from '@/components/backups/diff';
import { ConfigRestoreDialog } from '@/components/backups/restore';
import { ConfigSnapshotTimeline } from './ConfigSnapshotTimeline';
import { ConfigSnapshotCompareBar } from './ConfigSnapshotCompareBar';

interface ServerConfigHistoryTabProps {
  serverName: string;
  /** Whether the server is currently running (used for restore dialog) */
  isServerRunning?: boolean;
}

/**
 * Config History tab for the Server Detail page.
 * Shows a timeline of config snapshots for a specific server.
 *
 * Features:
 * - Timeline of snapshots in reverse chronological order
 * - Create snapshot button
 * - Compare mode: select two snapshots then diff them
 * - View Diff / Restore / Delete actions per snapshot
 * - Load More pagination
 */
export function ServerConfigHistoryTab({
  serverName,
  isServerRunning = false,
}: ServerConfigHistoryTabProps) {
  // Data
  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useServerConfigSnapshots(serverName);

  const deleteMutation = useDeleteConfigSnapshot();

  // Flatten pages into a single list (newest first — API returns in reverse chronological order)
  const snapshots: ConfigSnapshotItem[] = useMemo(
    () => data?.pages.flatMap((p) => p?.snapshots ?? []) ?? [],
    [data]
  );
  const total = data?.pages[0]?.total ?? 0;

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Diff dialog
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [diffSnapshotA, setDiffSnapshotA] = useState<ConfigSnapshotItem | null>(null);
  const [diffSnapshotB, setDiffSnapshotB] = useState<ConfigSnapshotItem | null>(null);

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<ConfigSnapshotItem | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<ConfigSnapshotItem[]>([]);

  // Tracking deleting IDs
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // --- Handlers ---

  const handleViewDiff = useCallback(
    (snapshot: ConfigSnapshotItem) => {
      // Diff against the next (older) snapshot in the list
      const idx = snapshots.findIndex((s) => s.id === snapshot.id);
      if (idx < 0 || idx >= snapshots.length - 1) return;
      const predecessor = snapshots[idx + 1];
      setDiffSnapshotA(predecessor); // older = base
      setDiffSnapshotB(snapshot); // newer = compare
      setDiffDialogOpen(true);
    },
    [snapshots]
  );

  const handleRestore = useCallback((snapshot: ConfigSnapshotItem) => {
    setRestoreSnapshot(snapshot);
    setRestoreDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (snapshot: ConfigSnapshotItem) => {
      setDeletingIds((prev) => new Set(prev).add(snapshot.id));
      deleteMutation.mutate(
        { serverName, snapshotId: snapshot.id },
        {
          onSettled: () => {
            setDeletingIds((prev) => {
              const next = new Set(prev);
              next.delete(snapshot.id);
              return next;
            });
          },
        }
      );
    },
    [serverName, deleteMutation]
  );

  const handleToggleCompareSelect = useCallback((snapshot: ConfigSnapshotItem) => {
    setSelectedForCompare((prev) => {
      const alreadySelected = prev.find((s) => s.id === snapshot.id);
      if (alreadySelected) {
        return prev.filter((s) => s.id !== snapshot.id);
      }
      // Max 2 selected
      if (prev.length >= 2) {
        return [prev[1], snapshot];
      }
      return [...prev, snapshot];
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedForCompare.length !== 2) return;
    // Sort by createdAt: older first = A, newer = B
    const sorted = [...selectedForCompare].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    setDiffSnapshotA(sorted[0]);
    setDiffSnapshotB(sorted[1]);
    setDiffDialogOpen(true);
  }, [selectedForCompare]);

  const handleCancelCompare = useCallback(() => {
    setCompareMode(false);
    setSelectedForCompare([]);
  }, []);

  const handleCloseDiff = useCallback(() => {
    setDiffDialogOpen(false);
    setDiffSnapshotA(null);
    setDiffSnapshotB(null);
    // If we came from compare mode, keep it active
  }, []);

  // Current snapshot ID (newest snapshot for restore diff reference)
  const currentSnapshotId = snapshots.length > 0 ? snapshots[0].id : undefined;

  // --- Render ---

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          Loading config history...
        </Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        Failed to load config history: {error?.message ?? 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Config History
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {snapshots.length >= 2 && !compareMode && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CompareArrowsIcon />}
              onClick={() => setCompareMode(true)}
            >
              Compare
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Snapshot
          </Button>
        </Box>
      </Box>

      {/* Compare bar (shown in compare mode) */}
      {compareMode && (
        <ConfigSnapshotCompareBar
          selectedSnapshots={selectedForCompare}
          onCompare={handleCompare}
          onCancelCompare={handleCancelCompare}
        />
      )}

      {/* Empty state */}
      {snapshots.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            gap: 1.5,
            color: 'text.secondary',
          }}
        >
          <CameraAltOutlinedIcon sx={{ fontSize: 48, opacity: 0.3 }} />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            No config snapshots yet
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Create a snapshot to save the current server configuration.
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ mt: 1 }}
          >
            Create First Snapshot
          </Button>
        </Box>
      )}

      {/* Timeline */}
      {snapshots.length > 0 && (
        <ConfigSnapshotTimeline
          snapshots={snapshots}
          total={total}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          compareMode={compareMode}
          selectedForCompare={selectedForCompare}
          deletingIds={deletingIds}
          onViewDiff={handleViewDiff}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onToggleCompareSelect={handleToggleCompareSelect}
          onLoadMore={fetchNextPage}
        />
      )}

      {/* Create Snapshot Dialog */}
      <CreateSnapshotDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        serverNames={[serverName]}
        defaultServer={serverName}
      />

      {/* Diff Dialog */}
      {diffDialogOpen && diffSnapshotA && diffSnapshotB && (
        <ConfigDiffDialog
          open={diffDialogOpen}
          onClose={handleCloseDiff}
          snapshotA={diffSnapshotA}
          snapshotB={diffSnapshotB}
          onRestoreA={(snapshot) => {
            handleCloseDiff();
            setRestoreSnapshot(snapshot);
            setRestoreDialogOpen(true);
          }}
        />
      )}

      {/* Restore Dialog */}
      {restoreDialogOpen && restoreSnapshot && (
        <ConfigRestoreDialog
          open={restoreDialogOpen}
          serverName={serverName}
          snapshot={restoreSnapshot}
          currentSnapshotId={currentSnapshotId}
          isServerRunning={isServerRunning}
          onClose={() => {
            setRestoreDialogOpen(false);
            setRestoreSnapshot(null);
          }}
        />
      )}
    </Box>
  );
}
