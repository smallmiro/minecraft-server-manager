'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha, useTheme } from '@mui/material/styles';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';
import { ConfigSnapshotQuickActions } from './ConfigSnapshotQuickActions';

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function formatFileCount(count: number): string {
  if (count === 0) return 'No files';
  return `${count} file${count !== 1 ? 's' : ''}`;
}

interface ConfigSnapshotTimelineItemProps {
  snapshot: ConfigSnapshotItem;
  /** True if this is the very first snapshot (no predecessor) */
  isFirst: boolean;
  /** True if this is the very last snapshot in the list */
  isLast: boolean;
  /** Whether compare mode is active */
  compareMode: boolean;
  /** Whether this snapshot is selected for comparison */
  isSelectedForCompare: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  onViewDiff: (snapshot: ConfigSnapshotItem) => void;
  onRestore: (snapshot: ConfigSnapshotItem) => void;
  onDelete: (snapshot: ConfigSnapshotItem) => void;
  onToggleCompareSelect: (snapshot: ConfigSnapshotItem) => void;
}

/**
 * A single item in the config snapshot timeline.
 * Shows snapshot metadata, file count, schedule badge, and action buttons.
 */
export function ConfigSnapshotTimelineItem({
  snapshot,
  isFirst,
  isLast,
  compareMode,
  isSelectedForCompare,
  isDeleting = false,
  onViewDiff,
  onRestore,
  onDelete,
  onToggleCompareSelect,
}: ConfigSnapshotTimelineItemProps) {
  const theme = useTheme();
  const isScheduled = !!snapshot.scheduleId;
  const hasPredecessor = !isFirst;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        position: 'relative',
        opacity: isDeleting ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Timeline spine & dot */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          width: 20,
        }}
      >
        {/* Top connector */}
        <Box
          sx={{
            width: 2,
            height: 12,
            bgcolor: isFirst ? 'transparent' : alpha(theme.palette.primary.main, 0.3),
          }}
        />
        {/* Dot */}
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: isSelectedForCompare
              ? 'primary.main'
              : alpha(theme.palette.primary.main, 0.5),
            border: '2px solid',
            borderColor: isSelectedForCompare ? 'primary.dark' : 'primary.main',
            flexShrink: 0,
            boxShadow: isSelectedForCompare
              ? `0 0 8px ${alpha(theme.palette.primary.main, 0.6)}`
              : 'none',
            transition: 'all 0.2s',
          }}
        />
        {/* Bottom connector */}
        <Box
          sx={{
            width: 2,
            flex: 1,
            minHeight: 16,
            bgcolor: isLast ? 'transparent' : alpha(theme.palette.primary.main, 0.3),
          }}
        />
      </Box>

      {/* Content card */}
      <Box
        sx={{
          flex: 1,
          mb: 1,
          pb: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: isSelectedForCompare
            ? alpha(theme.palette.primary.main, 0.5)
            : 'divider',
          bgcolor: isSelectedForCompare
            ? alpha(theme.palette.primary.main, 0.05)
            : 'background.paper',
          px: 2,
          py: 1.5,
          transition: 'border-color 0.2s, background-color 0.2s',
          cursor: compareMode ? 'pointer' : 'default',
          '&:hover': compareMode
            ? {
                borderColor: alpha(theme.palette.primary.main, 0.4),
                bgcolor: alpha(theme.palette.primary.main, 0.03),
              }
            : undefined,
        }}
        onClick={compareMode ? () => onToggleCompareSelect(snapshot) : undefined}
      >
        {/* Header row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.5,
          }}
        >
          {/* Timestamp & description */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace', flexShrink: 0 }}
              >
                {formatDateTime(snapshot.createdAt)}
              </Typography>

              {isScheduled && (
                <Chip
                  icon={<ScheduleIcon />}
                  label="Scheduled"
                  size="small"
                  variant="outlined"
                  color="default"
                  sx={{ height: 20, fontSize: 11, '& .MuiChip-icon': { fontSize: 12 } }}
                />
              )}
            </Box>

            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                mt: 0.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {snapshot.description || (
                <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  No description
                </Box>
              )}
            </Typography>
          </Box>

          {/* Actions */}
          <Box onClick={(e) => e.stopPropagation()}>
            <ConfigSnapshotQuickActions
              snapshot={snapshot}
              compareMode={compareMode}
              isSelectedForCompare={isSelectedForCompare}
              hasPredecessor={hasPredecessor}
              isDeleting={isDeleting}
              onViewDiff={onViewDiff}
              onRestore={onRestore}
              onDelete={onDelete}
              onToggleCompareSelect={onToggleCompareSelect}
            />
          </Box>
        </Box>

        {/* File count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <CameraAltOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">
            {formatFileCount(snapshot.files.length)}
            {isFirst && snapshot.files.length > 0 && ' — initial snapshot'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
