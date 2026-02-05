'use client';

import Chip from '@mui/material/Chip';
import { AUDIT_ACTION_COLORS, AUDIT_ACTION_LABELS } from '@/types/audit-log';

export interface AuditLogActionChipProps {
  action: string;
  size?: 'small' | 'medium';
}

/**
 * Action Chip component for audit log entries
 * Displays action with color-coded chip
 */
export function AuditLogActionChip({ action, size = 'small' }: AuditLogActionChipProps) {
  const color = AUDIT_ACTION_COLORS[action] || 'default';
  const label = AUDIT_ACTION_LABELS[action] || action;

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      variant="filled"
      sx={{
        fontWeight: 600,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
      }}
    />
  );
}
