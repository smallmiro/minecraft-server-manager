'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Link from 'next/link';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AuditLogActionChip } from '@/components/audit-logs/AuditLogActionChip';
import { AuditLogStatusChip } from '@/components/audit-logs/AuditLogStatusChip';
import { useServerAuditLogs } from '@/hooks/useAuditLogs';

export interface ServerActivityTabProps {
  serverName: string;
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
 * Server Activity Tab component
 * Shows recent audit logs for a specific server
 */
export function ServerActivityTab({ serverName }: ServerActivityTabProps) {
  const { data, isLoading, error } = useServerAuditLogs(serverName, { limit: 20 });

  if (isLoading) {
    return (
      <Box>
        {[...Array(5)].map((_, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, py: 1.5 }}>
            <Skeleton variant="rounded" width={60} height={24} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width={50} />
          </Box>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load activity: {error.message}
      </Alert>
    );
  }

  const logs = data?.logs ?? [];

  if (logs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No activity recorded for this server yet.
      </Typography>
    );
  }

  const viewAllHref = `/audit-logs?targetType=server&targetName=${encodeURIComponent(serverName)}`;

  return (
    <Box>
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AuditLogActionChip action={log.action} size="small" />
                  <Typography variant="body2" color="text.secondary">
                    by {log.actor.replace('api:', '').replace('cli:', '')}
                  </Typography>
                  <AuditLogStatusChip status={log.status} size="small" />
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

      {/* View full history link */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Button
          component={Link}
          href={viewAllHref}
          size="small"
          endIcon={<ArrowForwardIcon />}
          sx={{ textTransform: 'none' }}
        >
          View Full History
        </Button>
      </Box>
    </Box>
  );
}
