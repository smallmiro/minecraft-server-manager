'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';
import { BentoPanel, type BentoAccent } from './BentoPanel';

export interface BentoMetricCardProps {
  title: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  accent?: BentoAccent;
  description?: string;
  progress?: number;
}

function getAccentColor(theme: Theme, accent: BentoAccent) {
  if (accent === 'neutral') return theme.palette.text.secondary;
  return theme.palette[accent].main;
}

export function BentoMetricCard({
  title,
  value,
  unit,
  icon,
  accent = 'primary',
  description,
  progress,
}: BentoMetricCardProps) {
  const clampedProgress = progress === undefined ? null : Math.max(0, Math.min(100, progress));

  return (
    <BentoPanel
      component="article"
      aria-label={title}
      accent={accent}
      interactive
      data-testid="bento-metric-card"
      sx={{ height: '100%', minHeight: 152 }}
    >
      <Box sx={{ p: 2.25 }}>
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
                borderRadius: 2,
                color: (theme) => getAccentColor(theme, accent),
                bgcolor: (theme) => alpha(getAccentColor(theme, accent), 0.1),
              }}
            >
              {icon}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
          <Typography
            component="div"
            sx={{
              fontWeight: 800,
              fontSize: '2.15rem',
              lineHeight: 1,
              color: 'text.primary',
              letterSpacing: '-0.04em',
              overflowWrap: 'anywhere',
            }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              {unit}
            </Typography>
          )}
        </Box>

        {clampedProgress !== null && (
          <Box
            role="progressbar"
            aria-label={`${title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clampedProgress}
            sx={{
              height: 4,
              borderRadius: 2,
              mt: 1,
              bgcolor: 'rgba(255, 255, 255, 0.07)',
              overflow: 'hidden',
            }}
          >
            <Box
              data-testid="bento-metric-progress-fill"
              sx={{
                height: '100%',
                borderRadius: 2,
                bgcolor: (theme) => getAccentColor(theme, accent),
              }}
              style={{ width: `${clampedProgress}%` }}
            />
          </Box>
        )}

        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.75, fontSize: '0.72rem' }}
          >
            {description}
          </Typography>
        )}
      </Box>
    </BentoPanel>
  );
}
