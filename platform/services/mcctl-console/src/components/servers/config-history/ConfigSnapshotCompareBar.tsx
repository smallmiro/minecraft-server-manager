'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

function shortId(id: string): string {
  return id.substring(0, 8);
}

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

interface ConfigSnapshotCompareBarProps {
  /** Selected snapshots for comparison (max 2) */
  selectedSnapshots: ConfigSnapshotItem[];
  onCompare: () => void;
  onCancelCompare: () => void;
}

/**
 * Floating bar displayed during compare mode.
 * Shows selected snapshots and triggers the diff dialog when two are selected.
 */
export function ConfigSnapshotCompareBar({
  selectedSnapshots,
  onCompare,
  onCancelCompare,
}: ConfigSnapshotCompareBarProps) {
  const count = selectedSnapshots.length;
  const canCompare = count === 2;

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'sticky',
        top: 16,
        zIndex: 10,
        px: 2,
        py: 1.5,
        mb: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'primary.main',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <CompareArrowsIcon color="primary" fontSize="small" />

      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Compare mode
        </Typography>
        {count === 0 && (
          <Typography variant="caption" color="text.secondary">
            Select two snapshots to compare
          </Typography>
        )}
        {count === 1 && (
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(selectedSnapshots[0].createdAt)} selected — select one more
          </Typography>
        )}
        {count === 2 && (
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(selectedSnapshots[0].createdAt)} ({shortId(selectedSnapshots[0].id)})
            {' vs '}
            {formatDateTime(selectedSnapshots[1].createdAt)} ({shortId(selectedSnapshots[1].id)})
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<CompareArrowsIcon />}
          onClick={onCompare}
          disabled={!canCompare}
        >
          View Diff
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={onCancelCompare}
          color="inherit"
        >
          Cancel
        </Button>
      </Box>
    </Paper>
  );
}
