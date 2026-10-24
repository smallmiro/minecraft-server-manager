'use client';

import type { ElementType, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface BentoPanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** Heading element used for the title. Defaults to h2. */
  component?: Extract<ElementType, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>;
}

export function BentoPanelHeader({
  title,
  subtitle,
  icon,
  action,
  component = 'h2',
}: BentoPanelHeaderProps) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      justifyContent="space-between"
      spacing={2}
      sx={{ px: 2.5, pt: 2.5, pb: 1.5, minWidth: 0 }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        {icon != null && (
          <Box
            sx={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component={component}
            variant="h6"
            sx={{ fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}
          >
            {title}
          </Typography>
          {subtitle != null && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {action != null && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}
