'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BentoPanel } from '@/components/bento';
import type { PlatformSetting } from '@/types/platform-settings';

export interface LegacyEnvCardProps {
  settings: PlatformSetting[];
  removed: Set<string>;
  onToggleRemove: (key: string) => void;
}

/** Legacy and shadowed keys: present in .env but not applied. Removal is always explicit. */
export function LegacyEnvCard({ settings, removed, onToggleRemove }: LegacyEnvCardProps) {
  return (
    <BentoPanel
      role="region"
      aria-label="Legacy / Unused"
      accent="warning"
      sx={{ p: 2.5, gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' } }}
    >
      <Typography variant="h6" component="h2">
        Legacy / Unused
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These keys are not read by any current code or are overridden elsewhere. They stay in .env
        until you remove them.
      </Typography>
      <Stack spacing={1.5}>
        {settings.map((s) => {
          const isRemoved = removed.has(s.key);
          return (
            <Box
              key={s.key}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', opacity: isRemoved ? 0.55 : 1 }}
            >
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', textDecoration: isRemoved ? 'line-through' : 'none' }}
              >
                {s.key}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                {s.secret ? (s.configured ? 'Configured' : 'Not configured') : s.value}
              </Typography>
              {s.status === 'shadowed' ? (
                <Chip size="small" color="warning" label="Overridden by ecosystem.config.cjs; not applied" />
              ) : (
                <Chip size="small" color="warning" variant="outlined" label="Not read by any current code" />
              )}
              {s.differsFromEnv && <Chip size="small" color="warning" variant="outlined" label="differs" />}
              <Button
                size="small"
                color={isRemoved ? 'inherit' : 'warning'}
                aria-label={`${isRemoved ? 'Keep' : 'Remove'} ${s.key}`}
                onClick={() => onToggleRemove(s.key)}
              >
                {isRemoved ? 'Undo' : 'Remove'}
              </Button>
            </Box>
          );
        })}
      </Stack>
    </BentoPanel>
  );
}
