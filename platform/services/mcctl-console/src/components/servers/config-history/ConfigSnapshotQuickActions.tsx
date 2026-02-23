'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

interface ConfigSnapshotQuickActionsProps {
  snapshot: ConfigSnapshotItem;
  /** Whether compare mode is active */
  compareMode: boolean;
  /** Whether this snapshot is selected for compare */
  isSelectedForCompare: boolean;
  /** Whether this snapshot has a predecessor to diff against */
  hasPredecessor: boolean;
  /** Whether delete is in progress for this snapshot */
  isDeleting?: boolean;
  onViewDiff: (snapshot: ConfigSnapshotItem) => void;
  onRestore: (snapshot: ConfigSnapshotItem) => void;
  onDelete: (snapshot: ConfigSnapshotItem) => void;
  onToggleCompareSelect: (snapshot: ConfigSnapshotItem) => void;
}

/**
 * Quick action buttons for a config snapshot timeline item.
 * Shows View Diff, Restore, Delete actions; or compare toggle in compare mode.
 */
export function ConfigSnapshotQuickActions({
  snapshot,
  compareMode,
  isSelectedForCompare,
  hasPredecessor,
  isDeleting = false,
  onViewDiff,
  onRestore,
  onDelete,
  onToggleCompareSelect,
}: ConfigSnapshotQuickActionsProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      // Auto-cancel confirm after 3s
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    onDelete(snapshot);
    setDeleteConfirm(false);
  };

  if (compareMode) {
    return (
      <Tooltip
        title={isSelectedForCompare ? 'Remove from comparison' : 'Select for comparison'}
        placement="top"
      >
        <IconButton
          size="small"
          onClick={() => onToggleCompareSelect(snapshot)}
          color={isSelectedForCompare ? 'primary' : 'default'}
          aria-label={isSelectedForCompare ? 'Remove from comparison' : 'Select for comparison'}
        >
          {isSelectedForCompare ? (
            <CheckBoxIcon fontSize="small" />
          ) : (
            <CheckBoxOutlineBlankIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      {hasPredecessor && (
        <Tooltip title="View diff from previous snapshot" placement="top">
          <IconButton
            size="small"
            onClick={() => onViewDiff(snapshot)}
            aria-label="View diff"
          >
            <CompareArrowsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="Restore to this snapshot" placement="top">
        <IconButton
          size="small"
          onClick={() => onRestore(snapshot)}
          aria-label="Restore snapshot"
        >
          <RestoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip
        title={deleteConfirm ? 'Click again to confirm delete' : 'Delete snapshot'}
        placement="top"
      >
        <span>
          <Button
            size="small"
            variant={deleteConfirm ? 'contained' : 'text'}
            color="error"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            startIcon={
              isDeleting ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <DeleteOutlineIcon fontSize="small" />
              )
            }
            sx={{
              minWidth: 0,
              px: deleteConfirm ? 1 : 0.5,
              fontSize: 12,
              lineHeight: 1,
            }}
            aria-label={deleteConfirm ? 'Confirm delete' : 'Delete snapshot'}
          >
            {deleteConfirm ? 'Confirm' : ''}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}
