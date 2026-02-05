'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import { AuditLogActionChip } from './AuditLogActionChip';
import { AuditLogStatusChip } from './AuditLogStatusChip';
import { useAuditLogDetail } from '@/hooks/useAuditLogs';
import type { AuditLogEntry, AuditLogBrief } from '@/types/audit-log';

export interface AuditLogDetailProps {
  log: AuditLogEntry | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Format timestamp for display
 */
function formatDetailTime(timestamp: string): string {
  const time = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(time);
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

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Related logs tab panel
 */
function RelatedLogsList({ logs }: { logs: AuditLogBrief[] }) {
  if (logs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        No related logs found
      </Typography>
    );
  }

  return (
    <List dense sx={{ py: 0 }}>
      {logs.map((log) => (
        <ListItem
          key={log.id}
          sx={{
            px: 0,
            py: 1,
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
                {log.targetName && (
                  <Typography variant="body2" color="text.secondary">
                    {log.targetName}
                  </Typography>
                )}
              </Box>
            }
            secondary={formatRelativeTime(log.timestamp)}
          />
        </ListItem>
      ))}
    </List>
  );
}

/**
 * Audit log detail drawer component
 * Opens from the right side with full log details and related logs
 */
export function AuditLogDetail({ log, open, onClose }: AuditLogDetailProps) {
  const [relatedTab, setRelatedTab] = useState(0);
  const { data: detailData, isLoading } = useAuditLogDetail(log?.id ?? null, {
    enabled: open && !!log,
  });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 420 },
          maxWidth: '100%',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="h2">
          Audit Log Detail
        </Typography>
        <IconButton onClick={onClose} aria-label="Close detail drawer" autoFocus>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
        {!log ? (
          <Typography color="text.secondary">No log selected</Typography>
        ) : (
          <>
            {/* Basic info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                ID
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {log.id}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Timestamp
              </Typography>
              <Typography variant="body2">
                {formatDetailTime(log.timestamp)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Action
                </Typography>
                <AuditLogActionChip action={log.action} size="medium" />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Status
                </Typography>
                <AuditLogStatusChip status={log.status} size="medium" />
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Actor
              </Typography>
              <Typography variant="body2">{log.actor}</Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Target
              </Typography>
              <Typography variant="body2">
                {log.targetType}/{log.targetName}
              </Typography>
            </Box>

            {/* Error message */}
            {log.status === 'failure' && log.errorMessage && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {log.errorMessage}
              </Alert>
            )}

            {/* Details */}
            {log.details && Object.keys(log.details).length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Details
                </Typography>
                <Table size="small">
                  <TableBody>
                    {Object.entries(log.details).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            color: 'text.secondary',
                            border: 'none',
                            py: 0.5,
                            pl: 0,
                            width: '40%',
                          }}
                        >
                          {key}
                        </TableCell>
                        <TableCell sx={{ border: 'none', py: 0.5 }}>
                          {String(value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {/* Related logs */}
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Related Logs
            </Typography>

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <>
                <Tabs
                  value={relatedTab}
                  onChange={(_, newValue) => setRelatedTab(newValue)}
                  sx={{ mb: 1 }}
                >
                  <Tab
                    label={`Same Target (${detailData?.relatedLogs.sameTarget.length ?? 0})`}
                    sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                  />
                  <Tab
                    label={`Same Actor (${detailData?.relatedLogs.sameActor.length ?? 0})`}
                    sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                  />
                </Tabs>
                {relatedTab === 0 && (
                  <RelatedLogsList logs={detailData?.relatedLogs.sameTarget ?? []} />
                )}
                {relatedTab === 1 && (
                  <RelatedLogsList logs={detailData?.relatedLogs.sameActor ?? []} />
                )}
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
