'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Skeleton,
  Tooltip,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Link from 'next/link';
import { AuditLogActionChip } from '@/components/audit-logs/AuditLogActionChip';
import { AuditLogStatusChip } from '@/components/audit-logs/AuditLogStatusChip';
import { useRecentActivity } from '@/hooks/useAuditLogs';

export interface RecentActivityFeedProps {
  maxItems?: number;
}

/**
 * Format relative time
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
  return `${diffDays}d ago`;
}

/**
 * Format absolute time for tooltip
 */
function formatAbsoluteTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(timestamp));
}

/**
 * Recent Activity Feed for Dashboard
 * Fetches and displays the most recent audit log entries
 */
export function RecentActivityFeed({ maxItems = 5 }: RecentActivityFeedProps) {
  const { data, isLoading, error } = useRecentActivity(maxItems);

  const logs = data?.logs ?? [];

  return (
    <Card>
      <CardHeader
        title="Recent Activity"
        action={
          <Button
            component={Link}
            href="/audit-logs"
            size="small"
            endIcon={<ArrowForwardIcon />}
            sx={{ textTransform: 'none' }}
          >
            View All
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <List sx={{ py: 0 }}>
            {[...Array(maxItems)].map((_, i) => (
              <ListItem key={i} sx={{ px: 0, py: 1.5 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="rounded" width={60} height={24} />
                      <Skeleton variant="text" width={80} />
                      <Skeleton variant="text" width={60} />
                    </Box>
                  }
                  secondary={<Skeleton variant="text" width={50} />}
                />
              </ListItem>
            ))}
          </List>
        ) : error ? (
          <Typography color="text.secondary" align="center">
            Failed to load recent activity
          </Typography>
        ) : logs.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
            No recent activity
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {logs.map((log) => (
              <ListItem
                key={log.id}
                sx={{
                  px: 0,
                  py: 1.5,
                  '&:not(:last-child)': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <AuditLogActionChip action={log.action} size="small" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {log.targetName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        by {log.actor.replace('api:', '').replace('cli:', '')}
                      </Typography>
                      {log.status === 'failure' && (
                        <AuditLogStatusChip status={log.status} size="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Tooltip title={formatAbsoluteTime(log.timestamp)} arrow>
                      <Typography variant="caption" component="span" color="text.disabled">
                        {formatRelativeTime(log.timestamp)}
                      </Typography>
                    </Tooltip>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
