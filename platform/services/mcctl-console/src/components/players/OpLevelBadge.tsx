/**
 * OpLevelBadge Component
 * Displays OP level with color-coded badge and role label
 */

'use client';

import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';

/**
 * Level configuration with color, label, and icon
 */
const LEVEL_CONFIG = {
  1: { color: 'info' as const, label: 'Moderator', icon: '🛡️' },
  2: { color: 'success' as const, label: 'Gamemaster', icon: '🎮' },
  3: { color: 'warning' as const, label: 'Admin', icon: '⚙️' },
  4: { color: 'error' as const, label: 'Owner', icon: '👑' },
};

/**
 * OpLevelBadge Props
 */
export interface OpLevelBadgeProps {
  /**
   * OP level (1-4)
   */
  level: 1 | 2 | 3 | 4;

  /**
   * Show icon before label
   * @default false
   */
  showIcon?: boolean;

  /**
   * Compact mode - show only level number
   * @default false
   */
  compact?: boolean;

  /**
   * Chip size
   * @default 'medium'
   */
  size?: 'small' | 'medium';

  /**
   * Chip variant
   * @default 'filled'
   */
  variant?: 'filled' | 'outlined';
}

/**
 * OpLevelBadge - Display OP level with role and color
 */
export function OpLevelBadge({
  level,
  showIcon = false,
  compact = false,
  size = 'medium',
  variant = 'filled',
}: OpLevelBadgeProps) {
  const config = LEVEL_CONFIG[level];

  if (!config) {
    return null;
  }

  const label = compact ? level.toString() : `Level ${level} - ${config.label}`;

  const icon = showIcon ? (
    <Box component="span" sx={{ mr: 0.5 }}>
      {config.icon}
    </Box>
  ) : undefined;

  return (
    <Chip
      label={
        <>
          {icon}
          {label}
        </>
      }
      color={config.color}
      size={size}
      variant={variant}
    />
  );
}

/**
 * Get level color for external use
 */
export function getLevelColor(level: number): 'info' | 'success' | 'warning' | 'error' | 'default' {
  const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
  return config?.color || 'default';
}

/**
 * Get level label for external use
 */
export function getLevelLabel(level: number): string {
  const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
  return config?.label || 'Unknown';
}

/**
 * Get level icon for external use
 */
export function getLevelIcon(level: number): string {
  const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
  return config?.icon || '';
}
