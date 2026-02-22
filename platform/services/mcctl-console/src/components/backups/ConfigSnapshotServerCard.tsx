'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import DnsIcon from '@mui/icons-material/Dns';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { ConfigSnapshotItem, ConfigSnapshotScheduleItem } from '@/ports/api/IMcctlApiClient';

/**
 * Format relative time from timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return time.toLocaleDateString();
}

interface ConfigSnapshotServerCardProps {
  serverName: string;
  snapshots: ConfigSnapshotItem[];
  totalCount: number;
  schedule?: ConfigSnapshotScheduleItem;
  onViewHistory: (serverName: string) => void;
  onCreateSnapshot: (serverName: string) => void;
  onViewDiff: (serverName: string) => void;
}

/**
 * ConfigSnapshotServerCard - Per-server summary card displaying latest snapshot info,
 * total count, schedule status, and action buttons.
 */
export function ConfigSnapshotServerCard({
  serverName,
  snapshots,
  totalCount,
  schedule,
  onViewHistory,
  onCreateSnapshot,
  onViewDiff,
}: ConfigSnapshotServerCardProps) {
  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;
  const hasTwoSnapshots = snapshots.length >= 2;

  return (
    <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main' } }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Server info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <DnsIcon color="primary" />
            <Typography variant="h6" component="h3" fontWeight="bold">
              {serverName}
            </Typography>
          </Box>
        </Box>

        {/* Snapshot summary */}
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {latestSnapshot ? (
            <Tooltip title={`Latest: ${new Date(latestSnapshot.createdAt).toLocaleString()}`}>
              <Chip
                icon={<HistoryIcon sx={{ fontSize: 16 }} />}
                label={`Latest: ${formatRelativeTime(latestSnapshot.createdAt)}`}
                size="small"
                variant="outlined"
              />
            </Tooltip>
          ) : (
            <Chip
              label="No snapshots yet"
              size="small"
              variant="outlined"
              color="default"
            />
          )}

          {latestSnapshot && (
            <Chip
              label={`${latestSnapshot.files.length} files`}
              size="small"
              variant="outlined"
              color="info"
            />
          )}

          <Chip
            label={`${totalCount} snapshot${totalCount !== 1 ? 's' : ''} total`}
            size="small"
            variant="outlined"
          />

          {schedule ? (
            <Tooltip title={`Schedule: ${schedule.name} (${schedule.cronExpression})`}>
              <Chip
                icon={schedule.enabled ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ScheduleIcon sx={{ fontSize: 16 }} />}
                label={schedule.enabled ? `Schedule: Active` : 'Schedule: Paused'}
                size="small"
                variant="outlined"
                color={schedule.enabled ? 'success' : 'default'}
              />
            </Tooltip>
          ) : (
            <Chip
              label="No schedule"
              size="small"
              variant="outlined"
              color="default"
            />
          )}
        </Stack>

        {/* Action buttons */}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => onViewHistory(serverName)}
            disabled={totalCount === 0}
          >
            View History
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => onCreateSnapshot(serverName)}
          >
            Create Snapshot
          </Button>
          {hasTwoSnapshots && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CompareArrowsIcon />}
              onClick={() => onViewDiff(serverName)}
            >
              View Diff
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
