'use client';

import { Box, Typography, Skeleton, Link, Chip } from '@mui/material';
import { isNewerVersion, type ChangelogItem } from '@/lib/changelog';
import { useChangelog } from '@/hooks/useChangelog';
import { BentoPanel, BentoPanelHeader } from '@/components/bento';

interface ChangelogFeedProps {
  title?: string;
}

const GITHUB_CHANGELOG_PAGE =
  'https://github.com/smallmiro/minecraft-server-manager/blob/main/CHANGELOG.md';

const SECTIONS: { type: ChangelogItem['type']; label: string; color: 'success' | 'warning' | 'info' }[] = [
  { type: 'added', label: 'Added', color: 'success' },
  { type: 'fixed', label: 'Fixed', color: 'warning' },
  { type: 'changed', label: 'Changed', color: 'info' },
];

export function ChangelogFeed({ title = 'Recent Updates' }: ChangelogFeedProps) {
  const { data, isLoading, error } = useChangelog();

  if (isLoading) {
    return (
      <BentoPanel accent="primary" sx={{ height: '100%' }}>
        <BentoPanelHeader title={title} />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="75%" />
        </Box>
      </BentoPanel>
    );
  }

  if (error || !data) {
    return (
      <BentoPanel accent="primary" sx={{ height: '100%' }}>
        <BentoPanelHeader title={title} />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Typography color="text.secondary" align="center">
            Unable to load updates
          </Typography>
        </Box>
      </BentoPanel>
    );
  }

  const { latest, installedVersion } = data;
  const updateAvailable = isNewerVersion(latest.version, installedVersion);

  return (
    <BentoPanel accent="primary" sx={{ height: '100%' }}>
      <BentoPanelHeader
        title={title}
        action={
          <Link href={GITHUB_CHANGELOG_PAGE} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 13 }}>
            View all
          </Link>
        }
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
            [{latest.version}] - {latest.date}
          </Typography>
          {updateAvailable && (
            <Chip label="Update available" size="small" color="primary" sx={{ fontSize: 11, height: 20 }} />
          )}
        </Box>

        {SECTIONS.map(({ type, label, color }) => {
          const items = latest.items.filter((i) => i.type === type);
          if (items.length === 0) return null;
          return (
            <Box key={type} sx={{ mb: 1 }}>
              <Chip
                label={label}
                size="small"
                sx={{
                  bgcolor: `${color}.main`,
                  color: `${color}.contrastText`,
                  fontSize: 11,
                  height: 20,
                  mb: 0.5,
                }}
              />
              {items.map((item, i) => (
                <Typography key={i} variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>
                  • {item.message}
                </Typography>
              ))}
            </Box>
          );
        })}
      </Box>
    </BentoPanel>
  );
}
