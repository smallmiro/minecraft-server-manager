'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Link,
  Chip,
} from '@mui/material';
import { parseChangelog, type ChangelogVersion } from '@/lib/changelog';
import { BentoPanel, BentoPanelHeader } from '@/components/bento';

interface ChangelogFeedProps {
  maxVersions?: number;
  title?: string;
}

const GITHUB_CHANGELOG_URL =
  'https://api.github.com/repos/smallmiro/minecraft-server-manager/contents/CHANGELOG.md';

export function ChangelogFeed({ maxVersions = 2, title = 'Recent Updates' }: ChangelogFeedProps) {
  const [versions, setVersions] = useState<ChangelogVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChangelog() {
      try {
        const response = await fetch(GITHUB_CHANGELOG_URL, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch changelog');
        }

        const data = await response.json();
        const content = atob(data.content);
        const parsed = parseChangelog(content, maxVersions);
        setVersions(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchChangelog();
  }, [maxVersions]);

  if (isLoading) {
    return (
      <BentoPanel sx={{ height: '100%' }}>
        <BentoPanelHeader title={title} />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="70%" />
          <Box sx={{ mt: 2 }}>
            <Skeleton variant="text" width="60%" height={28} />
            <Skeleton variant="text" width="75%" />
          </Box>
        </Box>
      </BentoPanel>
    );
  }

  if (error) {
    return (
      <BentoPanel sx={{ height: '100%' }}>
        <BentoPanelHeader title={title} />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Typography color="text.secondary" align="center">
            Unable to load updates
          </Typography>
        </Box>
      </BentoPanel>
    );
  }

  return (
    <BentoPanel sx={{ height: '100%' }}>
      <BentoPanelHeader
        title={title}
        action={
          <Link
            href="https://github.com/smallmiro/minecraft-server-manager/blob/develop/CHANGELOG.md"
            target="_blank"
            rel="noopener"
            sx={{ fontSize: 13 }}
          >
            View all
          </Link>
        }
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        {versions.map((ver, vIndex) => {
          // Group items by type
          const added = ver.items.filter((i) => i.type === 'added');
          const fixed = ver.items.filter((i) => i.type === 'fixed');
          const changed = ver.items.filter((i) => i.type === 'changed');

          return (
            <Box
              key={ver.version}
              sx={{
                mb: vIndex < versions.length - 1 ? 2.5 : 0,
                pb: vIndex < versions.length - 1 ? 2 : 0,
                borderBottom: vIndex < versions.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              {/* Version Header */}
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}
              >
                [{ver.version}] - {ver.date}
              </Typography>

              {/* Added */}
              {added.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Chip
                    label="Added"
                    size="small"
                    sx={{
                      bgcolor: 'success.main',
                      color: 'success.contrastText',
                      fontSize: 11,
                      height: 20,
                      mb: 0.5,
                    }}
                  />
                  {added.map((item, i) => (
                    <Typography key={i} variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>
                      • {item.message}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Fixed */}
              {fixed.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Chip
                    label="Fixed"
                    size="small"
                    sx={{
                      bgcolor: 'warning.main',
                      color: 'warning.contrastText',
                      fontSize: 11,
                      height: 20,
                      mb: 0.5,
                    }}
                  />
                  {fixed.map((item, i) => (
                    <Typography key={i} variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>
                      • {item.message}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Changed */}
              {changed.length > 0 && (
                <Box>
                  <Chip
                    label="Changed"
                    size="small"
                    sx={{
                      bgcolor: 'info.main',
                      color: 'info.contrastText',
                      fontSize: 11,
                      height: 20,
                      mb: 0.5,
                    }}
                  />
                  {changed.map((item, i) => (
                    <Typography key={i} variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>
                      • {item.message}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </BentoPanel>
  );
}
