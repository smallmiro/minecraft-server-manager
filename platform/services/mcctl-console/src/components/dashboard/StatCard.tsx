'use client';

import { ReactNode } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export interface StatCardProps {
  title: string;
  value: number;
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'info' | 'secondary';
  description?: string;
  /** Optional unit/suffix rendered next to the value (e.g. "/ 8"). */
  unit?: string;
  /** Optional 0-100 ratio; renders an accent progress bar. Omit when no data. */
  progress?: number;
}

const colorMap = {
  primary: '#1bd96a',
  success: '#22c55e',
  info: '#3b82f6',
  secondary: '#7c3aed',
} as const;

export function StatCard({
  title,
  value,
  icon,
  color = 'primary',
  description,
  unit,
  progress,
}: StatCardProps) {
  const accent = colorMap[color];
  const clampedProgress =
    progress === undefined ? null : Math.max(0, Math.min(100, progress));

  return (
    <Card
      data-testid="stat-card"
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: accent,
        },
      }}
    >
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.02em' }}
          >
            {title}
          </Typography>
          {icon && (
            <Box sx={{ ml: 'auto', display: 'inline-flex', color: accent, opacity: 0.8 }}>
              {icon}
            </Box>
          )}
        </Box>

        {/* Figure row */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography
            component="div"
            sx={{ fontWeight: 700, fontSize: '1.9rem', lineHeight: 1, color: 'text.primary' }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              {unit}
            </Typography>
          )}
        </Box>

        {/* Progress bar (computed ratios only) */}
        {clampedProgress !== null && (
          <Box
            sx={{
              height: 4,
              borderRadius: 2,
              mt: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <Box
              data-testid="stat-card-progress-fill"
              sx={{ height: '100%', borderRadius: 2, background: accent }}
              style={{ width: `${clampedProgress}%` }}
            />
          </Box>
        )}

        {/* Subline */}
        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.75, fontSize: '0.72rem' }}
          >
            {description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
