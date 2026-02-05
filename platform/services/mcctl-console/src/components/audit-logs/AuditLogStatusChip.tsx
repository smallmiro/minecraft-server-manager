'use client';

import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export interface AuditLogStatusChipProps {
  status: 'success' | 'failure';
  size?: 'small' | 'medium';
}

/**
 * Status Chip component for audit log entries
 */
export function AuditLogStatusChip({ status, size = 'small' }: AuditLogStatusChipProps) {
  return (
    <Chip
      icon={status === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
      label={status === 'success' ? 'OK' : 'Error'}
      color={status === 'success' ? 'success' : 'error'}
      size={size}
      variant="outlined"
      sx={{
        fontWeight: 500,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
      }}
    />
  );
}
