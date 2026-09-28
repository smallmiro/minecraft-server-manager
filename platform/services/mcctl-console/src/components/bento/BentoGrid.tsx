'use client';

import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

const baseSx: SxProps<Theme> = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    sm: 'repeat(6, minmax(0, 1fr))',
    md: 'repeat(12, minmax(0, 1fr))',
  },
  gap: { xs: 2, sm: 2.5 },
  alignItems: 'stretch',
  minWidth: 0,
};

export function BentoGrid({ component = 'section', sx, ...props }: BoxProps) {
  const callerSx = Array.isArray(sx) ? sx : [sx];

  return (
    <Box
      component={component}
      sx={[baseSx, ...callerSx] as SxProps<Theme>}
      {...props}
    />
  );
}
