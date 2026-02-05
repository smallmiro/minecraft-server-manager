'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DnsIcon from '@mui/icons-material/Dns';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Link from 'next/link';
import { AuditLogActionChip } from './AuditLogActionChip';
import { AuditLogStatusChip } from './AuditLogStatusChip';
import type { AuditLogEntry, AuditLogQueryParams } from '@/types/audit-log';

export interface AuditLogTableProps {
  logs: AuditLogEntry[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  filters: AuditLogQueryParams;
  onFiltersChange: (filters: AuditLogQueryParams) => void;
  onRowClick?: (log: AuditLogEntry) => void;
  onRetry?: () => void;
}

/**
 * Format relative time from timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(time);
}

/**
 * Format absolute timestamp for tooltip
 */
function formatAbsoluteTime(timestamp: string): string {
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
 * Get target icon based on target type
 */
function getTargetIcon(targetType: string) {
  switch (targetType) {
    case 'server':
      return <DnsIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />;
    case 'player':
      return <PersonIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />;
    default:
      return null;
  }
}

/**
 * Get target link href
 */
function getTargetHref(targetType: string, targetName: string): string | null {
  if (targetType === 'server') return `/servers/${encodeURIComponent(targetName)}`;
  if (targetType === 'player') return `/players`;
  return null;
}

/**
 * Expandable row component
 */
function AuditLogRow({
  log,
  onClick,
}: {
  log: AuditLogEntry;
  onClick?: (log: AuditLogEntry) => void;
}) {
  const [open, setOpen] = useState(log.status === 'failure');
  const hasDetails = log.details && Object.keys(log.details).length > 0;
  const hasError = log.status === 'failure' && log.errorMessage;
  const isExpandable = hasDetails || hasError;
  const targetHref = getTargetHref(log.targetType, log.targetName);

  return (
    <>
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          '&:last-child td, &:last-child th': { border: 0 },
        }}
        onClick={() => onClick?.(log)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(log);
          }
        }}
        role="button"
        aria-label={`${log.action} by ${log.actor} on ${log.targetName}`}
      >
        {/* Expand toggle */}
        <TableCell padding="checkbox" sx={{ width: 48 }}>
          {isExpandable && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              aria-label={open ? 'Collapse details' : 'Expand details'}
            >
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          )}
        </TableCell>

        {/* Timestamp */}
        <TableCell>
          <Tooltip title={formatAbsoluteTime(log.timestamp)} arrow>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {formatRelativeTime(log.timestamp)}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* Action */}
        <TableCell>
          <AuditLogActionChip action={log.action} />
        </TableCell>

        {/* Actor */}
        <TableCell>
          {log.actor.startsWith('cli:') ? (
            <Chip
              label={log.actor.replace('cli:', '')}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ) : (
            <Typography variant="body2">
              {log.actor.replace('api:', '')}
            </Typography>
          )}
        </TableCell>

        {/* Target */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getTargetIcon(log.targetType)}
            {targetHref ? (
              <Link
                href={targetHref}
                style={{ textDecoration: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'primary.main',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {log.targetName}
                </Typography>
              </Link>
            ) : (
              <Typography variant="body2">{log.targetName}</Typography>
            )}
          </Box>
        </TableCell>

        {/* Status */}
        <TableCell>
          <AuditLogStatusChip status={log.status} />
        </TableCell>
      </TableRow>

      {/* Expandable details row */}
      {isExpandable && (
        <TableRow>
          <TableCell sx={{ py: 0 }} colSpan={6}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ py: 2, px: 2 }}>
                {hasError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {log.errorMessage}
                  </Alert>
                )}
                {hasDetails && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Details
                    </Typography>
                    <Table size="small" sx={{ width: 'auto' }}>
                      <TableBody>
                        {Object.entries(log.details!).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell
                              sx={{
                                fontWeight: 600,
                                color: 'text.secondary',
                                border: 'none',
                                py: 0.5,
                                pl: 0,
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
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Audit log table component
 * Custom MUI Table (not DataGrid) per UX review requirements
 */
export function AuditLogTable({
  logs,
  total,
  isLoading,
  error,
  filters,
  onFiltersChange,
  onRowClick,
  onRetry,
}: AuditLogTableProps) {
  const page = Math.floor((filters.offset || 0) / (filters.limit || 50));
  const rowsPerPage = filters.limit || 50;

  const handlePageChange = (_: unknown, newPage: number) => {
    onFiltersChange({
      ...filters,
      offset: newPage * rowsPerPage,
    });
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    onFiltersChange({
      ...filters,
      limit: newLimit,
      offset: 0,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Timestamp</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell padding="checkbox" />
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={70} height={24} /></TableCell>
                  <TableCell><Skeleton variant="text" width={60} /></TableCell>
                  <TableCell><Skeleton variant="text" width={100} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={50} height={24} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          )
        }
      >
        {error.message || 'Failed to load audit logs'}
      </Alert>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <AssignmentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No audit logs found
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
          Try adjusting your filters or check back later.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onFiltersChange({ limit: filters.limit, sort: filters.sort })}
        >
          Reset Filters
        </Button>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ width: 48 }} />
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Timestamp</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actor</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Target</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <AuditLogRow key={log.id} log={log} onClick={onRowClick} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[25, 50, 100]}
        aria-label="Audit log pagination"
      />
    </Paper>
  );
}
