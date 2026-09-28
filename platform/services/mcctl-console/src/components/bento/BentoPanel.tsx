'use client';

import Paper, { type PaperProps } from '@mui/material/Paper';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';

export type BentoAccent =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

export interface BentoPanelProps extends PaperProps {
  accent?: BentoAccent;
  interactive?: boolean;
}

function getAccentColor(theme: Theme, accent: BentoAccent) {
  if (accent === 'neutral') return theme.palette.divider;
  return theme.palette[accent].main;
}

export function BentoPanel({
  accent = 'neutral',
  interactive = false,
  component = 'section',
  elevation = 0,
  sx,
  ...props
}: BentoPanelProps) {
  const baseSx: SxProps<Theme> = (theme) => {
    const accentColor = getAccentColor(theme, accent);

    return {
      minWidth: 0,
      overflow: 'hidden',
      borderRadius: 4,
      border: '1px solid',
      borderColor: accent === 'neutral' ? 'divider' : alpha(accentColor, 0.3),
      backgroundColor: 'background.paper',
      backgroundImage: 'none',
      transition: interactive
        ? 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease'
        : 'none',
      ...(interactive && {
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(accentColor, 0.38),
          boxShadow: `0 18px 42px ${alpha(accentColor, 0.09)}`,
        },
      }),
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
        '&:hover': { transform: 'none' },
      },
    };
  };
  const callerSx = Array.isArray(sx) ? sx : [sx];

  return (
    <Paper
      component={component}
      elevation={elevation}
      data-accent={accent}
      data-interactive={interactive ? 'true' : 'false'}
      sx={[baseSx, ...callerSx] as SxProps<Theme>}
      {...props}
    />
  );
}
