'use client';

import { useState, useCallback, useEffect } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useConfigSnapshotDiff } from '@/hooks/useConfigSnapshotDiff';
import { ConfigDiffFileTree } from './ConfigDiffFileTree';
import { ConfigDiffViewer } from './ConfigDiffViewer';
import { ConfigDiffViewToggle, type DiffViewMode } from './ConfigDiffViewToggle';
import { ConfigDiffSummary } from './ConfigDiffSummary';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

interface ConfigDiffDialogProps {
  open: boolean;
  snapshotA: ConfigSnapshotItem;
  snapshotB: ConfigSnapshotItem;
  onClose: () => void;
  /** Optional: called when the "Restore to Snapshot A" button is clicked */
  onRestoreA?: (snapshot: ConfigSnapshotItem) => void;
}

/**
 * Full-screen or large modal dialog for comparing two config snapshots
 */
export function ConfigDiffDialog({
  open,
  snapshotA,
  snapshotB,
  onClose,
  onRestoreA,
}: ConfigDiffDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<DiffViewMode>(isMobile ? 'unified' : 'unified');

  const { data, isLoading, isError, error } = useConfigSnapshotDiff(snapshotA.id, snapshotB.id, {
    enabled: open,
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFile(undefined);
      setViewMode(isMobile ? 'unified' : 'unified');
    }
  }, [open, isMobile]);

  // Auto-select first file when data loads
  useEffect(() => {
    if (data?.changes && data.changes.length > 0 && !selectedFile) {
      setSelectedFile(data.changes[0].path);
    }
  }, [data, selectedFile]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  const handleRestoreA = useCallback(() => {
    onRestoreA?.(snapshotA);
    onClose();
  }, [onRestoreA, snapshotA, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isMobile}
      aria-labelledby="config-diff-dialog-title"
      PaperProps={{
        sx: {
          height: isMobile ? '100%' : '90vh',
          maxHeight: isMobile ? '100%' : '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        id="config-diff-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
          flexShrink: 0,
        }}
      >
        <CompareArrowsIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="span">
            Config Diff
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25 }}
          >
            Snapshot A: {formatDateTime(snapshotA.createdAt)}
            <Box component="span" sx={{ mx: 1 }}>
              vs
            </Box>
            Snapshot B: {formatDateTime(snapshotB.createdAt)}
          </Typography>
        </Box>

        <ConfigDiffViewToggle
          value={viewMode}
          onChange={setViewMode}
        />

        <IconButton
          onClick={onClose}
          aria-label="Close diff dialog"
          size="small"
          sx={{ ml: 1 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          p: 0,
        }}
      >
        {isLoading && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 2,
            }}
          >
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading diff...
            </Typography>
          </Box>
        )}

        {isError && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">
              Failed to load diff: {error?.message ?? 'Unknown error'}
            </Alert>
          </Box>
        )}

        {data && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              overflow: 'hidden',
            }}
          >
            {/* File tree (left panel) */}
            <Box
              sx={{
                width: { xs: '100%', md: 220 },
                flexShrink: 0,
                height: { xs: 'auto', md: '100%' },
                maxHeight: { xs: 160, md: 'none' },
                overflow: 'auto',
              }}
            >
              <ConfigDiffFileTree
                changes={data.changes}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
              />
            </Box>

            <Divider orientation={isMobile ? 'horizontal' : 'vertical'} />

            {/* Diff content (right panel) */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <ConfigDiffViewer
                changes={data.changes}
                selectedFile={selectedFile}
                viewMode={viewMode}
              />
            </Box>
          </Box>
        )}
      </DialogContent>

      {data && (
        <>
          <Divider />
          <ConfigDiffSummary summary={data.summary} />
        </>
      )}

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        {onRestoreA && (
          <Button
            onClick={handleRestoreA}
            variant="outlined"
            color="warning"
            startIcon={<RestoreIcon />}
            disabled={isLoading}
          >
            Restore to Snapshot A
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
