'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { PaperProps } from '@mui/material/Paper';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import { BentoPanel } from './BentoPanel';

export interface PageHeroProps extends Omit<PaperProps, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  children?: ReactNode;
}

export function PageHero({
  title,
  description,
  eyebrow,
  icon,
  status,
  actions,
  compact = false,
  children,
  sx,
  ...props
}: PageHeroProps) {
  const callerSx = Array.isArray(sx) ? sx : [sx];

  return (
    <BentoPanel
      accent="primary"
      data-testid="page-hero"
      data-compact={compact ? 'true' : 'false'}
      sx={[
        (theme) => ({
          p: compact ? { xs: 2.5, sm: 3 } : { xs: 3, sm: 4 },
          position: 'relative',
          background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 52%, ${theme.palette.background.paper} 100%)`,
          boxShadow: compact
            ? 'none'
            : `0 28px 70px ${alpha(theme.palette.common.black, 0.2)}`,
        }),
        ...callerSx,
      ] as SxProps<Theme>}
      {...props}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
          gap: { xs: 2, sm: 3 },
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {(icon || eyebrow) && (
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: compact ? 1 : 2 }}>
              {icon && (
                <Box
                  sx={{
                    width: compact ? 36 : 42,
                    height: compact ? 36 : 42,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    borderRadius: 2.5,
                    color: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                  }}
                >
                  {icon}
                </Box>
              )}
              {eyebrow && (
                <Typography
                  variant="overline"
                  sx={{ color: 'primary.light', fontWeight: 700, letterSpacing: '0.12em' }}
                >
                  {eyebrow}
                </Typography>
              )}
            </Stack>
          )}

          <Typography
            component="h1"
            sx={{
              fontSize: compact
                ? { xs: '1.6rem', sm: '2rem' }
                : { xs: '2rem', sm: '2.65rem' },
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </Typography>

          {description && (
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>
              {description}
            </Typography>
          )}
        </Box>

        {(status || actions) && (
          <Stack
            spacing={1.25}
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
            sx={{ minWidth: 0 }}
          >
            {status}
            {actions}
          </Stack>
        )}
      </Box>

      {children && <Box sx={{ mt: compact ? 2.5 : 4, minWidth: 0 }}>{children}</Box>}
    </BentoPanel>
  );
}
