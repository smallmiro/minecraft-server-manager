'use client';

import Chip from '@mui/material/Chip';

interface PermissionBadgeProps {
  permission: 'view' | 'manage' | 'admin';
  size?: 'small' | 'medium';
}

const permissionMap = {
  admin: {
    label: 'Owner',
    color: 'primary' as const,
    variant: 'filled' as const,
  },
  manage: {
    label: 'Operator',
    color: 'info' as const,
    variant: 'outlined' as const,
  },
  view: {
    label: 'Viewer',
    color: 'default' as const,
    variant: 'outlined' as const,
  },
};

export function PermissionBadge({ permission, size = 'medium' }: PermissionBadgeProps) {
  const config = permissionMap[permission];

  return (
    <Chip
      label={config.label}
      color={config.color}
      variant={config.variant}
      size={size}
    />
  );
}
