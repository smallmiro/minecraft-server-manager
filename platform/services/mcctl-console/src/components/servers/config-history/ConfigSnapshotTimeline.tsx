'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { ConfigSnapshotItem } from '@/ports/api/IMcctlApiClient';
import { ConfigSnapshotTimelineItem } from './ConfigSnapshotTimelineItem';

/** Group snapshots by date label (e.g. "Feb 22, 2026") */
function groupByDate(snapshots: ConfigSnapshotItem[]): Array<{
  label: string;
  items: ConfigSnapshotItem[];
}> {
  const groups = new Map<string, ConfigSnapshotItem[]>();

  for (const s of snapshots) {
    const label = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(s.createdAt));

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(s);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

interface ConfigSnapshotTimelineProps {
  snapshots: ConfigSnapshotItem[];
  /** Total count from API (for showing load-more) */
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  compareMode: boolean;
  selectedForCompare: ConfigSnapshotItem[];
  deletingIds: Set<string>;
  onViewDiff: (snapshot: ConfigSnapshotItem) => void;
  onRestore: (snapshot: ConfigSnapshotItem) => void;
  onDelete: (snapshot: ConfigSnapshotItem) => void;
  onToggleCompareSelect: (snapshot: ConfigSnapshotItem) => void;
  onLoadMore: () => void;
}

/**
 * Vertical timeline displaying config snapshots grouped by date.
 * Supports Load More pagination and compare mode.
 */
export function ConfigSnapshotTimeline({
  snapshots,
  total,
  hasNextPage,
  isFetchingNextPage,
  compareMode,
  selectedForCompare,
  deletingIds,
  onViewDiff,
  onRestore,
  onDelete,
  onToggleCompareSelect,
  onLoadMore,
}: ConfigSnapshotTimelineProps) {
  const groups = groupByDate(snapshots);
  const selectedIds = new Set(selectedForCompare.map((s) => s.id));

  // Track global position to determine isFirst/isLast
  let globalIndex = 0;

  return (
    <Box>
      {groups.map((group, groupIndex) => (
        <Box key={group.label}>
          {/* Date separator */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 1.5,
              mt: groupIndex > 0 ? 2 : 0,
            }}
          >
            <Divider sx={{ flex: 1 }} />
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {group.label}
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>

          {/* Timeline items */}
          {group.items.map((snapshot) => {
            const currentIndex = globalIndex;
            globalIndex++;
            return (
              <ConfigSnapshotTimelineItem
                key={snapshot.id}
                snapshot={snapshot}
                isFirst={currentIndex === snapshots.length - 1}
                isLast={currentIndex === 0}
                compareMode={compareMode}
                isSelectedForCompare={selectedIds.has(snapshot.id)}
                isDeleting={deletingIds.has(snapshot.id)}
                onViewDiff={onViewDiff}
                onRestore={onRestore}
                onDelete={onDelete}
                onToggleCompareSelect={onToggleCompareSelect}
              />
            );
          })}
        </Box>
      ))}

      {/* Load More */}
      {hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            startIcon={
              isFetchingNextPage ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <ExpandMoreIcon />
              )
            }
            variant="outlined"
            size="small"
          >
            {isFetchingNextPage
              ? 'Loading...'
              : `Load More (${total - snapshots.length} remaining)`}
          </Button>
        </Box>
      )}
    </Box>
  );
}
