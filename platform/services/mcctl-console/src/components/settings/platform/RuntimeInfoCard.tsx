'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BentoPanel } from '@/components/bento';
import type { PlatformRuntimeItem } from '@/types/platform-settings';

export function RuntimeInfoCard({ items }: { items: PlatformRuntimeItem[] }) {
  return (
    <BentoPanel
      role="region"
      aria-label="Runtime (PM2)"
      accent="info"
      sx={{ p: 2.5, gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 6' } }}
    >
      <Typography variant="h6" component="h2">
        Runtime (PM2)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Injected by ecosystem.config.cjs and read-only here. A BETTER_AUTH_* value set in Console &amp; Logging
        above takes precedence; re-run <code>mcctl console init</code> to move them to .env.
      </Typography>
      <Stack spacing={1.5}>
        {items.map((item) => (
          <Box key={item.key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {item.key}
            </Typography>
            {item.value !== undefined ? (
              <Typography variant="body2" sx={{ wordBreak: 'break-all', textAlign: 'right' }}>
                {item.value}
              </Typography>
            ) : (
              <Chip
                size="small"
                variant="outlined"
                color={item.configured ? 'success' : 'default'}
                label={item.configured ? 'Configured' : 'Not configured'}
              />
            )}
          </Box>
        ))}
      </Stack>
    </BentoPanel>
  );
}
