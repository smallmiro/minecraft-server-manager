'use client';

import { ReactNode } from 'react';
import { Card, CardContent, Typography, Box, alpha } from '@mui/material';

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
        minHeight: 152,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
        background: (theme) =>
          `radial-gradient(circle at 100% 0%, ${alpha(accent, 0.12)} 0%, transparent 42%), ${theme.palette.background.paper}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(accent, 0.35),
          boxShadow: `0 18px 42px ${alpha(accent, 0.09)}`,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 6,
          height: 6,
          top: 16,
          right: 16,
          borderRadius: 999,
          background: accent,
          boxShadow: `0 0 16px ${alpha(accent, 0.9)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.02em' }}
          >
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                ml: 'auto',
                mr: 1.5,
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                color: accent,
                borderRadius: 2,
                bgcolor: alpha(accent, 0.1),
              }}
            >
              {icon}
            </Box>
          )}
        </Box>

        {/* Figure row */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography
            component="div"
            sx={{ fontWeight: 800, fontSize: '2.15rem', lineHeight: 1, color: 'text.primary', letterSpacing: '-0.04em' }}
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
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
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
